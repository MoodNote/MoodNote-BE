import prisma from "../config/database";
import { passwordUtil } from "../utils/password.util";
import { jwtUtil } from "../utils/jwt.util";
import { authConfig } from "../config/auth.config";

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
			throw new Error("Invalid credentials");
		}

		if (user.role !== "ADMIN") {
			throw new Error("Forbidden: Admin access required");
		}

		if (!user.isActive) {
			throw new Error("Account is deactivated");
		}

		if (!user.isEmailVerified) {
			throw new Error("Email not verified");
		}

		const isPasswordValid = await passwordUtil.compare(
			password,
			user.password,
		);
		if (!isPasswordValid) {
			throw new Error("Invalid credentials");
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
			throw new Error("Invalid or expired refresh token");
		}

		const stored = await prisma.refreshToken.findUnique({
			where: { token: refreshToken },
			include: { user: true },
		});

		if (!stored) throw new Error("Refresh token not found");
		if (stored.isRevoked) throw new Error("Refresh token has been revoked");
		if (new Date() > stored.expiresAt) throw new Error("Refresh token has expired");
		if (stored.user.role !== "ADMIN") throw new Error("Forbidden: Admin access required");
		if (!stored.user.isActive) throw new Error("Account is deactivated");

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
