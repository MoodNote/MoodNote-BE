import prisma from "../config/database";
import { passwordUtil } from "../utils/password.util";
import { jwtUtil } from "../utils/jwt.util";
import { authConfig } from "../config/auth.config";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";

class AdminAuthService {
	async adminLogin(email: string, password: string) {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
			select: {
				id: true,
				email: true,
				username: true,
				name: true,
				password: true,
				role: true,
				isActive: true,
				isEmailVerified: true,
			},
		});

		if (!user) {
			throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
		}

		if (user.role !== "ADMIN") {
			throw new AppError("Forbidden: Admin access required", HttpStatus.FORBIDDEN);
		}

		if (!user.isActive) {
			throw new AppError("Account is deactivated", HttpStatus.FORBIDDEN);
		}

		if (!user.isEmailVerified) {
			throw new AppError("Email not verified", HttpStatus.FORBIDDEN);
		}

		const isPasswordValid = await passwordUtil.compare(
			password,
			user.password,
		);
		if (!isPasswordValid) {
			throw new AppError("Invalid credentials", HttpStatus.UNAUTHORIZED);
		}

		const accessToken = jwtUtil.generateAdminAccessToken(
			user.id,
			user.email,
		);
		const refreshToken = jwtUtil.generateAdminRefreshToken(
			user.id,
			user.email,
		);

		const expiresAt = new Date(
			Date.now() + authConfig.jwt.adminRefreshExpiresInMs,
		);
		await prisma.refreshToken.create({
			data: { userId: user.id, token: refreshToken, expiresAt },
		});

		return {
			accessToken,
			refreshToken,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				name: user.name,
				role: user.role,
			},
		};
	}

	async refreshAdminToken(refreshToken: string) {
		try {
			jwtUtil.verifyAdminRefreshToken(refreshToken);
		} catch {
			throw new AppError("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
		}

		const stored = await prisma.refreshToken.findUnique({
			where: { token: refreshToken },
			include: { user: true },
		});

		if (!stored) throw new AppError("Refresh token not found", HttpStatus.UNAUTHORIZED);
		if (stored.isRevoked) throw new AppError("Refresh token has been revoked", HttpStatus.UNAUTHORIZED);
		if (new Date() > stored.expiresAt) throw new AppError("Refresh token has expired", HttpStatus.UNAUTHORIZED);
		if (stored.user.role !== "ADMIN") throw new AppError("Forbidden: Admin access required", HttpStatus.FORBIDDEN);
		if (!stored.user.isActive) throw new AppError("Account is deactivated", HttpStatus.FORBIDDEN);

		const newAccessToken = jwtUtil.generateAdminAccessToken(
			stored.user.id,
			stored.user.email,
		);

		return { accessToken: newAccessToken, expiresIn: 3600 };
	}

	async adminLogout(refreshToken: string) {
		await prisma.refreshToken.updateMany({
			where: { token: refreshToken },
			data: { isRevoked: true },
		});
	}
}

export const adminAuthService = new AdminAuthService();
