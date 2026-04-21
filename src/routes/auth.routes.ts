import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import { authenticate } from "../middlewares/auth.middleware";
import { authValidators } from "../validators/auth.validator";
import {
	loginRateLimiter,
	authRateLimiter,
} from "../middlewares/rateLimit.middleware";
import { checkAccountLockout } from "../middlewares/bruteForce.middleware";

const router = Router();

// Public routes with rate limiting
router.post(
	"/register",
	authRateLimiter,
	validate(authValidators.register),
	authController.register,
);

router.post(
	"/verify-email",
	authRateLimiter,
	validate(authValidators.verifyEmail),
	authController.verifyEmail,
);

router.post(
	"/resend-verification",
	authRateLimiter,
	validate(authValidators.resendVerification),
	authController.resendVerificationOtp,
);

router.post(
	"/login",
	loginRateLimiter,
	checkAccountLockout,
	validate(authValidators.login),
	authController.login,
);

router.post(
	"/refresh",
	authRateLimiter,
	validate(authValidators.refreshToken),
	authController.refreshToken,
);

router.post(
	"/forgot-password",
	authRateLimiter,
	validate(authValidators.forgotPassword),
	authController.forgotPassword,
);

router.post(
	"/resend-reset-otp",
	authRateLimiter,
	validate(authValidators.resendResetOtp),
	authController.resendResetOtp,
);

router.post(
	"/verify-reset-otp",
	authRateLimiter,
	validate(authValidators.verifyResetOtp),
	authController.verifyResetOtp,
);

router.post(
	"/reset-password",
	authRateLimiter,
	validate(authValidators.resetPassword),
	authController.resetPassword,
);

// Protected routes (require authentication)
router.post(
	"/change-password",
	authenticate,
	validate(authValidators.changePassword),
	authController.changePassword,
);

router.post(
	"/logout",
	authenticate,
	validate(authValidators.logout),
	authController.logout,
);

export default router;
