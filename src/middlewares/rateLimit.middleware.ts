import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { authConfig } from "../config/auth.config";
import { redis } from "../config/redis";

const redisStore = (prefix: string) =>
	new RedisStore({
		prefix,
		sendCommand: (...args: string[]) => (redis as any).call(...args),
	});

export const generalRateLimiter = rateLimit({
	windowMs: authConfig.rateLimit.windowMs,
	max: authConfig.rateLimit.max,
	store: redisStore("rl:general:"),
	message: {
		success: false,
		message: "Too many requests, please try again later",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	store: redisStore("rl:auth:"),
	keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${req.path}`,
	message: {
		success: false,
		message: "Too many authentication attempts, please try again later",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const loginRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	store: redisStore("rl:login:"),
	skipSuccessfulRequests: true,
	message: {
		success: false,
		message: "Too many login attempts, please try again after 15 minutes",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export const broadcastRateLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	store: redisStore("rl:broadcast:"),
	message: {
		success: false,
		message: "Too many broadcast requests, please try again later",
	},
	standardHeaders: true,
	legacyHeaders: false,
});
