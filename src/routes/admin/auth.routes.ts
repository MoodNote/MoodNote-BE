import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { authRateLimiter, loginRateLimiter } from "../../middlewares/rateLimit.middleware";
import { adminAuthController } from "../../controllers/admin.auth.controller";
import { adminValidators } from "../../validators/admin.validator";

const router = Router();

router.post(
	"/login",
	loginRateLimiter,
	validate(adminValidators.adminLogin),
	adminAuthController.adminLogin,
);

router.post(
	"/refresh",
	authRateLimiter,
	validate(adminValidators.adminRefresh),
	adminAuthController.adminRefreshToken,
);

router.post(
	"/logout",
	authRateLimiter,
	validate(adminValidators.adminLogout),
	adminAuthController.adminLogout,
);

export default router;
