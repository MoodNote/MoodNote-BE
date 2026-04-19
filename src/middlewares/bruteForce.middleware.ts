import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { authConfig } from "../config/auth.config";
import { HttpStatus } from "../utils/http-status.util";

/**
 * Check if user account is locked due to failed login attempts
 */
export const checkAccountLockout = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { identifier } = req.body;

		if (!identifier) {
			return next();
		}

		// Detect whether identifier is an email or username
		const isEmail = identifier.includes("@");
		const user = isEmail
			? await prisma.user.findUnique({
					where: { email: identifier.toLowerCase() },
					select: {
						id: true,
						failedLoginAttempts: true,
						lockoutUntil: true,
					},
				})
			: await prisma.user.findUnique({
					where: { username: identifier.toLowerCase() },
					select: {
						id: true,
						failedLoginAttempts: true,
						lockoutUntil: true,
					},
				});

		if (!user) {
			// Don't reveal that user doesn't exist (prevent enumeration)
			return next();
		}

		// Check if account is locked
		if (user.lockoutUntil && new Date() < user.lockoutUntil) {
			const remainingTime = Math.ceil(
				(user.lockoutUntil.getTime() - Date.now()) / 1000 / 60,
			);
			return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
				success: false,
				message: `Account is locked. Please try again in ${remainingTime} minutes`,
			});
		}

		// If lockout period has passed, reset failed attempts
		if (user.lockoutUntil && new Date() >= user.lockoutUntil) {
			await prisma.user.update({
				where: { id: user.id },
				data: {
					failedLoginAttempts: 0,
					lockoutUntil: null,
				},
			});
		}

		next();
	} catch (error) {
		next(error);
	}
};
