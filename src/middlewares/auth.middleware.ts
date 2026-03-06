import { Request, Response, NextFunction } from "express";
import { jwtUtil } from "../utils/jwt.util";
import prisma from "../config/database";

// Extend Express Request type
declare global {
	namespace Express {
		interface Request {
			user?: {
				userId: string;
				email: string;
			};
		}
	}
}

export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		// Extract token from Authorization header
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				message: "Access token is required",
			});
		}

		const token = authHeader.substring(7); // Remove 'Bearer ' prefix

		// Verify token
		const payload = jwtUtil.verifyAccessToken(token);

		// Check if user exists and is active
		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
			select: {
				id: true,
				email: true,
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

		// Attach user to request
		req.user = {
			userId: user.id,
			email: user.email,
		};

		next();
	} catch (error: any) {
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				success: false,
				message: "Access token has expired",
			});
		}
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({
				success: false,
				message: "Invalid access token",
			});
		}
		return res.status(500).json({
			success: false,
			message: "Authentication failed",
		});
	}
};
