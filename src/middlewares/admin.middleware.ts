import { Request, Response, NextFunction } from "express";
import { jwtUtil } from "../utils/jwt.util";
import prisma from "../config/database";

export const authenticateAdmin = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				message: "Admin access token is required",
			});
		}

		const token = authHeader.substring(7);

		// Verify using admin secret
		const payload = jwtUtil.verifyAdminAccessToken(token);

		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
			select: {
				id: true,
				email: true,
				role: true,
				isActive: true,
				isEmailVerified: true,
			},
		});

		if (!user) {
			return res.status(401).json({
				success: false,
				message: "User not found",
			});
		}

		if (!user.isActive) {
			return res.status(403).json({
				success: false,
				message: "Account is deactivated",
			});
		}

		if (!user.isEmailVerified) {
			return res.status(403).json({
				success: false,
				message: "Email not verified",
			});
		}

		if (user.role !== "ADMIN") {
			return res.status(403).json({
				success: false,
				message: "Forbidden: Admin access required",
			});
		}

		req.user = {
			userId: user.id,
			email: user.email,
			role: user.role,
		};

		next();
	} catch (error: any) {
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				success: false,
				message: "Admin access token has expired",
			});
		}
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({
				success: false,
				message: "Invalid admin access token",
			});
		}
		return res.status(500).json({
			success: false,
			message: "Authentication failed",
		});
	}
};
