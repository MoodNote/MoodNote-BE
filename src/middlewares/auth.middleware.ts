import { Request, Response, NextFunction } from "express";
import { jwtUtil } from "../utils/jwt.util";
import prisma from "../config/database";
import { HttpStatus } from "../utils/http-status.util";

// Extend Express Request type
declare global {
	namespace Express {
		interface Request {
			user?: {
				userId: string;
				email: string;
				role: string;
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
			return res.status(HttpStatus.UNAUTHORIZED).json({
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
				role: true,
				isActive: true,
				isEmailVerified: true,
			},
		});

		if (!user) {
			return res.status(HttpStatus.UNAUTHORIZED).json({
				success: false,
				message: "User not found",
			});
		}

		if (!user.isActive) {
			return res.status(HttpStatus.FORBIDDEN).json({
				success: false,
				message: "Account is deactivated",
			});
		}

		if (!user.isEmailVerified) {
			return res.status(HttpStatus.FORBIDDEN).json({
				success: false,
				message: "Email not verified",
			});
		}

		// Attach user to request
		req.user = {
			userId: user.id,
			email: user.email,
			role: user.role,
		};

		next();
	} catch (error: any) {
		if (error.name === "TokenExpiredError") {
			return res.status(HttpStatus.UNAUTHORIZED).json({
				success: false,
				message: "Access token has expired",
			});
		}
		if (error.name === "JsonWebTokenError") {
			return res.status(HttpStatus.UNAUTHORIZED).json({
				success: false,
				message: "Invalid access token",
			});
		}
		return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			success: false,
			message: "Authentication failed",
		});
	}
};
