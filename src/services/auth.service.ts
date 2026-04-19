import prisma from "../config/database";
import { passwordUtil } from "../utils/password.util";
import { jwtUtil } from "../utils/jwt.util";
import { tokenUtil } from "../utils/token.util";
import { emailService } from "./email.service";
import { authConfig } from "../config/auth.config";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";

class AuthService {
	/**
	 * FR-01: Register new user
	 */
	async register(data: {
		email: string;
		username: string;
		password: string;
		name: string;
	}) {
		// Check if email already exists
		const existingUser = await prisma.user.findUnique({
			where: { email: data.email.toLowerCase() },
		});

		if (existingUser) {
			throw new AppError("Email already registered", HttpStatus.CONFLICT);
		}

		// Check if username already exists
		const existingUsername = await prisma.user.findUnique({
			where: { username: data.username.toLowerCase() },
		});

		if (existingUsername) {
			throw new AppError("Username already taken", HttpStatus.CONFLICT);
		}

		// Validate password strength
		const passwordValidation = passwordUtil.validate(data.password);
		if (!passwordValidation.isValid) {
			throw new AppError(passwordValidation.errors.join(", "), HttpStatus.BAD_REQUEST);
		}

		// Check for common passwords
		if (passwordUtil.isCommonPassword(data.password)) {
			throw new AppError(
				"Password is too common, please choose a stronger password",
				HttpStatus.BAD_REQUEST,
			);
		}

		// Hash password
		const hashedPassword = await passwordUtil.hash(data.password);

		// Create user
		const user = await prisma.user.create({
			data: {
				email: data.email.toLowerCase(),
				username: data.username.toLowerCase(),
				name: data.name,
				password: hashedPassword,
				isEmailVerified: false,
				isActive: true,
			},
			select: {
				id: true,
				email: true,
				username: true,
				name: true,
				createdAt: true,
			},
		});

		// Generate OTP for email verification
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const expiresAt = new Date(
			Date.now() + authConfig.email.verificationExpiry,
		);

		// Invalidate any existing unused tokens
		await prisma.emailVerification.updateMany({
			where: { userId: user.id, isUsed: false },
			data: { isUsed: true },
		});

		await prisma.emailVerification.create({
			data: {
				userId: user.id,
				token: hashedOtp,
				expiresAt,
			},
		});

		// Send OTP verification email
		await emailService.sendVerificationEmail(user.email, user.name, otp);

		return {
			user,
			message:
				"Registration successful. Please check your email to verify your account.",
		};
	}

	/**
	 * FR-01: Verify email address with OTP
	 */
	async verifyEmail(email: string, otp: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});

		if (!user) {
			throw new AppError("Invalid email or OTP", HttpStatus.BAD_REQUEST);
		}

		if (user.isEmailVerified) {
			throw new AppError("Email is already verified", HttpStatus.CONFLICT);
		}

		const hashedOtp = tokenUtil.hashToken(otp);
		const verification = await prisma.emailVerification.findFirst({
			where: {
				userId: user.id,
				token: hashedOtp,
				isUsed: false,
				expiresAt: { gt: new Date() },
			},
		});

		if (!verification) {
			throw new AppError("Invalid or expired OTP", HttpStatus.BAD_REQUEST);
		}

		// Update user and mark token as used
		await prisma.$transaction([
			prisma.user.update({
				where: { id: user.id },
				data: { isEmailVerified: true },
			}),
			prisma.emailVerification.update({
				where: { id: verification.id },
				data: { isUsed: true },
			}),
		]);

		return {
			message: "Email verified successfully. You can now login.",
		};
	}

	/**
	 * FR-01: Resend email verification OTP
	 */
	async resendVerificationOtp(email: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});

		if (!user) {
			return {
				message:
					"If an account exists with this email, a new OTP has been sent.",
			};
		}

		if (user.isEmailVerified) {
			throw new AppError("Email is already verified", HttpStatus.CONFLICT);
		}

		// Invalidate old tokens
		await prisma.emailVerification.updateMany({
			where: { userId: user.id, isUsed: false },
			data: { isUsed: true },
		});

		// Generate new OTP
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const expiresAt = new Date(
			Date.now() + authConfig.email.verificationExpiry,
		);

		await prisma.emailVerification.create({
			data: {
				userId: user.id,
				token: hashedOtp,
				expiresAt,
			},
		});

		await emailService.sendVerificationEmail(user.email, user.name, otp);

		return {
			message:
				"If an account exists with this email, a new OTP has been sent.",
		};
	}

	/**
	 * FR-02: Login user
	 */
	async login(identifier: string, password: string) {
		// Detect whether identifier is an email or username
		const isEmail = identifier.includes("@");
		const user = isEmail
			? await prisma.user.findUnique({
					where: { email: identifier.toLowerCase() },
				})
			: await prisma.user.findUnique({
					where: { username: identifier.toLowerCase() },
				});

		// Don't reveal if user exists (prevent enumeration)
		if (!user) {
			throw new AppError("Invalid email/username or password", HttpStatus.UNAUTHORIZED);
		}

		// Check if account is locked
		if (user.lockoutUntil && new Date() < user.lockoutUntil) {
			throw new AppError(
				"Account is locked due to multiple failed login attempts",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		// Verify password
		const isPasswordValid = await passwordUtil.compare(
			password,
			user.password,
		);

		if (!isPasswordValid) {
			// Increment failed login attempts
			const newFailedAttempts = user.failedLoginAttempts + 1;
			const updateData: any = { failedLoginAttempts: newFailedAttempts };

			// Lock account if max attempts reached
			if (newFailedAttempts >= authConfig.security.maxLoginAttempts) {
				updateData.lockoutUntil = new Date(
					Date.now() + authConfig.security.lockoutDuration,
				);
			}

			await prisma.user.update({
				where: { id: user.id },
				data: updateData,
			});

			throw new AppError("Invalid email/username or password", HttpStatus.UNAUTHORIZED);
		}

		// Check if email is verified
		if (!user.isEmailVerified) {
			throw new AppError("Please verify your email before logging in", HttpStatus.FORBIDDEN);
		}

		// Check if account is active
		if (!user.isActive) {
			throw new AppError("Account is deactivated", HttpStatus.FORBIDDEN);
		}

		// Reset failed login attempts and update last login
		await prisma.user.update({
			where: { id: user.id },
			data: {
				failedLoginAttempts: 0,
				lockoutUntil: null,
				lastLoginAt: new Date(),
			},
		});

		// Generate tokens
		const accessToken = jwtUtil.generateAccessToken(user.id, user.email);
		const refreshToken = jwtUtil.generateRefreshToken(user.id, user.email);

		// Store refresh token
		const refreshTokenExpiry = new Date(
			Date.now() + authConfig.jwt.refreshExpiresInMs,
		);
		await prisma.refreshToken.create({
			data: {
				userId: user.id,
				token: refreshToken,
				expiresAt: refreshTokenExpiry,
			},
		});

		return {
			accessToken,
			refreshToken,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				name: user.name,
				isEmailVerified: user.isEmailVerified,
			},
		};
	}

	/**
	 * FR-02: Refresh access token
	 */
	async refreshAccessToken(refreshToken: string) {
		// Verify refresh token
		try {
			jwtUtil.verifyRefreshToken(refreshToken);
		} catch {
			throw new AppError("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
		}

		// Check if refresh token exists in database and is not revoked
		const storedToken = await prisma.refreshToken.findUnique({
			where: { token: refreshToken },
			include: { user: true },
		});

		if (!storedToken) {
			throw new AppError("Refresh token not found", HttpStatus.UNAUTHORIZED);
		}

		if (storedToken.isRevoked) {
			throw new AppError("Refresh token has been revoked", HttpStatus.UNAUTHORIZED);
		}

		if (new Date() > storedToken.expiresAt) {
			throw new AppError("Refresh token has expired", HttpStatus.UNAUTHORIZED);
		}

		// Generate new access token
		const newAccessToken = jwtUtil.generateAccessToken(
			storedToken.user.id,
			storedToken.user.email,
		);

		return {
			accessToken: newAccessToken,
		};
	}

	/**
	 * FR-03: Request password reset
	 */
	async forgotPassword(email: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});

		// Always return success to prevent user enumeration
		// Even if user doesn't exist, return same response
		if (!user) {
			return {
				message:
					"If an account exists with this email, a password reset link has been sent.",
			};
		}

		// Generate OTP
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const expiresAt = new Date(
			Date.now() + authConfig.email.passwordResetExpiry,
		);

		// Invalidate all previous password reset tokens
		await prisma.passwordReset.updateMany({
			where: { userId: user.id, isUsed: false },
			data: { isUsed: true },
		});

		// Create new password reset token
		await prisma.passwordReset.create({
			data: {
				userId: user.id,
				token: hashedOtp,
				expiresAt,
			},
		});

		// Send password reset email with OTP
		await emailService.sendPasswordResetEmail(user.email, otp, user.name);

		return {
			message:
				"If an account exists with this email, a password reset link has been sent.",
		};
	}

	/**
	 * FR-03: Resend password reset OTP
	 */
	async resendResetOtp(email: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});

		// Always return generic message to prevent user enumeration
		if (!user) {
			return {
				message:
					"If an account exists with this email, a new OTP has been sent.",
			};
		}

		// Invalidate all previous unused reset tokens
		await prisma.passwordReset.updateMany({
			where: { userId: user.id, isUsed: false },
			data: { isUsed: true },
		});

		// Generate new OTP
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const expiresAt = new Date(
			Date.now() + authConfig.email.passwordResetExpiry,
		);

		await prisma.passwordReset.create({
			data: {
				userId: user.id,
				token: hashedOtp,
				expiresAt,
			},
		});

		await emailService.sendPasswordResetEmail(user.email, otp, user.name);

		return {
			message:
				"If an account exists with this email, a new OTP has been sent.",
		};
	}

	/**
	 * FR-03: Verify OTP for password reset
	 */
	async verifyResetOtp(email: string, otp: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});

		if (!user) {
			throw new AppError("Invalid email or OTP", HttpStatus.BAD_REQUEST);
		}

		const hashedOtp = tokenUtil.hashToken(otp);
		const resetRecord = await prisma.passwordReset.findFirst({
			where: {
				userId: user.id,
				token: hashedOtp,
				isUsed: false,
				expiresAt: { gt: new Date() },
			},
		});

		if (!resetRecord) {
			throw new AppError("Invalid or expired OTP", HttpStatus.BAD_REQUEST);
		}

		await prisma.passwordReset.update({
			where: { id: resetRecord.id },
			data: { isVerified: true },
		});

		return {
			message: "OTP verified. You can now reset your password.",
		};
	}

	/**
	 * FR-03: Reset password after OTP verification
	 */
	async resetPassword(email: string, newPassword: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});

		if (!user) {
			throw new AppError("Invalid request", HttpStatus.BAD_REQUEST);
		}

		const resetRecord = await prisma.passwordReset.findFirst({
			where: {
				userId: user.id,
				isVerified: true,
				isUsed: false,
				expiresAt: { gt: new Date() },
			},
		});

		if (!resetRecord) {
			throw new AppError(
				"No verified OTP found. Please verify your OTP first.",
				HttpStatus.BAD_REQUEST,
			);
		}

		// Validate new password
		const passwordValidation = passwordUtil.validate(newPassword);
		if (!passwordValidation.isValid) {
			throw new AppError(passwordValidation.errors.join(", "), HttpStatus.BAD_REQUEST);
		}

		if (passwordUtil.isCommonPassword(newPassword)) {
			throw new AppError(
				"Password is too common, please choose a stronger password",
				HttpStatus.BAD_REQUEST,
			);
		}

		// Hash new password
		const hashedPassword = await passwordUtil.hash(newPassword);

		// Update password, mark token as used, and invalidate all refresh tokens
		await prisma.$transaction([
			prisma.user.update({
				where: { id: user.id },
				data: { password: hashedPassword },
			}),
			prisma.passwordReset.update({
				where: { id: resetRecord.id },
				data: { isUsed: true },
			}),
			prisma.refreshToken.updateMany({
				where: { userId: user.id },
				data: { isRevoked: true },
			}),
		]);

		return {
			message:
				"Password reset successfully. Please login with your new password.",
		};
	}

	/**
	 * FR-04: Change password (authenticated)
	 */
	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
	) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new AppError("User not found", HttpStatus.NOT_FOUND);
		}

		// Verify current password
		const isCurrentPasswordValid = await passwordUtil.compare(
			currentPassword,
			user.password,
		);

		if (!isCurrentPasswordValid) {
			throw new AppError("Current password is incorrect", HttpStatus.BAD_REQUEST);
		}

		// Validate new password
		const passwordValidation = passwordUtil.validate(newPassword);
		if (!passwordValidation.isValid) {
			throw new AppError(passwordValidation.errors.join(", "), HttpStatus.BAD_REQUEST);
		}

		if (passwordUtil.isCommonPassword(newPassword)) {
			throw new AppError(
				"Password is too common, please choose a stronger password",
				HttpStatus.BAD_REQUEST,
			);
		}

		// Ensure new password is different from current
		const isSamePassword = await passwordUtil.compare(
			newPassword,
			user.password,
		);
		if (isSamePassword) {
			throw new AppError(
				"New password must be different from current password",
				HttpStatus.BAD_REQUEST,
			);
		}

		// Hash new password
		const hashedPassword = await passwordUtil.hash(newPassword);

		// Update password and invalidate all OTHER refresh tokens (keep current session)
		await prisma.user.update({
			where: { id: userId },
			data: { password: hashedPassword },
		});

		await emailService.sendPasswordChangedEmail(user.email, user.name);

		return {
			message: "Password changed successfully",
		};
	}

	/**
	 * Logout - revoke refresh token and remove device tokens
	 */
	async logout(refreshToken: string, deviceToken?: string) {
		const ops: Promise<unknown>[] = [
			prisma.refreshToken.updateMany({
				where: { token: refreshToken },
				data: { isRevoked: true },
			}),
		];

		if (deviceToken) {
			ops.push(
				prisma.deviceToken.deleteMany({
					where: { token: deviceToken },
				}),
			);
		}

		await Promise.all(ops);

		return {
			message: "Logged out successfully",
		};
	}
}

export const authService = new AuthService();
