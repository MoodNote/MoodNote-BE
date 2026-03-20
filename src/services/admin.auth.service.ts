import prisma from "../config/database";
import { passwordUtil } from "../utils/password.util";
import { jwtUtil } from "../utils/jwt.util";

export const adminAuthService = {
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

		return {
			accessToken,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				name: user.name,
				role: user.role,
			},
		};
	},
};
