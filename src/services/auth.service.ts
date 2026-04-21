import prisma from "../config/database";
import { redis } from "../config/redis";
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

		// Generate and store OTP in Redis (overwrites any existing OTP for this user)
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const ttlSecs = Math.floor(authConfig.email.verificationExpiry / 1000);
		await redis.set(`otp:email_verify:${user.id}`, hashedOtp, "EX", ttlSecs);

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
		const storedHash = await redis.get(`otp:email_verify:${user.id}`);

		if (!storedHash || storedHash !== hashedOtp) {
			throw new AppError("Invalid or expired OTP", HttpStatus.BAD_REQUEST);
		}

		await Promise.all([
			redis.del(`otp:email_verify:${user.id}`),
			prisma.user.update({
				where: { id: user.id },
				data: { isEmailVerified: true },
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

		// Overwrite existing OTP in Redis with a new one
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const ttlSecs = Math.floor(authConfig.email.verificationExpiry / 1000);
		await redis.set(`otp:email_verify:${user.id}`, hashedOtp, "EX", ttlSecs);

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

		// Verify password
		const isPasswordValid = await passwordUtil.compare(
			password,
			user.password,
		);

		if (!isPasswordValid) {
			const bruteKey = `brute:${user.id}`;
			const lockoutSecs = Math.floor(authConfig.security.lockoutDuration / 1000);
			const newAttempts = await redis.incr(bruteKey);
			if (newAttempts === 1 || newAttempts >= authConfig.security.maxLoginAttempts) {
				await redis.expire(bruteKey, lockoutSecs);
			}
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

		// Clear lockout and update last login
		await redis.del(`brute:${user.id}`);
		await prisma.user.update({
			where: { id: user.id },
			data: { lastLoginAt: new Date() },
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
		if (!user) {
			return {
				message:
					"If an account exists with this email, a password reset link has been sent.",
			};
		}

		// Generate and store OTP in Redis (overwrites any existing reset OTP)
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const ttlSecs = Math.floor(authConfig.email.passwordResetExpiry / 1000);
		await redis.set(`otp:pwd_reset:${user.id}`, hashedOtp, "EX", ttlSecs);

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

		// Overwrite existing reset OTP in Redis with a new one
		const otp = tokenUtil.generateOTP();
		const hashedOtp = tokenUtil.hashToken(otp);
		const ttlSecs = Math.floor(authConfig.email.passwordResetExpiry / 1000);
		await redis.set(`otp:pwd_reset:${user.id}`, hashedOtp, "EX", ttlSecs);

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
		const storedHash = await redis.get(`otp:pwd_reset:${user.id}`);

		if (!storedHash || storedHash !== hashedOtp) {
			throw new AppError("Invalid or expired OTP", HttpStatus.BAD_REQUEST);
		}

		// Delete the OTP and set the verified flag (same TTL as the original OTP)
		const ttlSecs = Math.floor(authConfig.email.passwordResetExpiry / 1000);
		await Promise.all([
			redis.del(`otp:pwd_reset:${user.id}`),
			redis.set(`otp:pwd_reset_verified:${user.id}`, "1", "EX", ttlSecs),
		]);

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

		const isVerified = await redis.get(`otp:pwd_reset_verified:${user.id}`);

		if (!isVerified) {
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

		// Clear verified flag and update password + invalidate all refresh tokens atomically
		await Promise.all([
			redis.del(`otp:pwd_reset_verified:${user.id}`),
			prisma.$transaction([
				prisma.user.update({
					where: { id: user.id },
					data: { password: hashedPassword },
				}),
				prisma.refreshToken.updateMany({
					where: { userId: user.id },
					data: { isRevoked: true },
				}),
			]),
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
