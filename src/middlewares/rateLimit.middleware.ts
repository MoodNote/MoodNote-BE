import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authConfig } from "../config/auth.config";

/**
 * General API rate limiter: 100 requests per minute per IP
 */
export const generalRateLimiter = rateLimit({
	windowMs: authConfig.rateLimit.windowMs,
	max: authConfig.rateLimit.max,
	message: {
		success: false,
		message: "Too many requests, please try again later",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

/**
 * Strict rate limiter for auth endpoints: 5 requests per 15 minutes per IP per route
 */
export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5,
	keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${req.path}`,
	message: {
		success: false,
		message: "Too many authentication attempts, please try again later",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	skipSuccessfulRequests: true, // Don't count successful logins
	message: {
		success: false,
		message: "Too many login attempts, please try again after 15 minutes",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

/**
 * Broadcast rate limiter: 10 requests per minute per IP (admin only)
 */
export const broadcastRateLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 10,
	message: {
		success: false,
		message: "Too many broadcast requests, please try again later",
	},
	standardHeaders: true,
	legacyHeaders: false,
});
