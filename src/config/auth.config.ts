export const authConfig = {
	jwt: {
		secret: process.env.JWT_SECRET || "default-secret-change-in-production",
		expiresIn: process.env.JWT_EXPIRES_IN || "24h",
		refreshSecret:
			process.env.REFRESH_TOKEN_SECRET ||
			"default-refresh-secret-change-in-production",
		refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
	},
	bcrypt: {
		saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12"),
	},
	email: {
		verificationExpiry: parseInt(
			process.env.EMAIL_VERIFICATION_EXPIRY || "86400000",
		), // 24 hours
		passwordResetExpiry: parseInt(
			process.env.PASSWORD_RESET_EXPIRY || "3600000",
		), // 1 hour
	},
	security: {
		maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5"),
		lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || "900000"), // 15 minutes
		sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || "1800000"), // 30 minutes
	},
	rateLimit: {
		windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "60000"), // 1 minute
		max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
	},
	urls: {
		frontend: process.env.FRONTEND_URL || "http://localhost:5173",
		backend: process.env.BACKEND_URL || "http://localhost:3000",
	},
};
