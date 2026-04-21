import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { redis } from "../config/redis";
import { authConfig } from "../config/auth.config";
import { HttpStatus } from "../utils/http-status.util";

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

		const isEmail = identifier.includes("@");
		const user = isEmail
			? await prisma.user.findUnique({
					where: { email: identifier.toLowerCase() },
					select: { id: true },
				})
			: await prisma.user.findUnique({
					where: { username: identifier.toLowerCase() },
					select: { id: true },
				});

		if (!user) {
			return next();
		}

		try {
			const bruteKey = `brute:${user.id}`;
			const attempts = parseInt((await redis.get(bruteKey)) || "0");

			if (attempts >= authConfig.security.maxLoginAttempts) {
				const remainingSeconds = await redis.ttl(bruteKey);
				const remainingMinutes = Math.ceil(remainingSeconds / 60);
				return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
					success: false,
					message: `Account is locked. Please try again in ${remainingMinutes} minutes`,
				});
			}
		} catch {
			// fail-open: if Redis is down, allow through
		}

		next();
	} catch (error) {
		next(error);
	}
};
