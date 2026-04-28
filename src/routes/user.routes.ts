import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { generalRateLimiter } from "../middlewares/rateLimit.middleware";
import { validate } from "../middlewares/validate.middleware";
import { userController } from "../controllers/user.controller";
import { userValidators } from "../validators/user.validator";

const router = Router();

router.get("/me", generalRateLimiter, authenticate, userController.getProfile);
router.patch(
	"/me",
	generalRateLimiter,
	authenticate,
	validate(userValidators.updateProfile),
	userController.updateProfile,
);

router.get("/settings", generalRateLimiter, authenticate, userController.getSettings);
router.patch(
	"/settings",
	generalRateLimiter,
	authenticate,
	validate(userValidators.updateSettings),
	userController.updateSettings,
);

router.get("/me/export", generalRateLimiter, authenticate, userController.exportData);
router.post(
	"/me/import",
	generalRateLimiter,
	authenticate,
	validate(userValidators.importData),
	userController.importData,
);
router.delete(
	"/me",
	generalRateLimiter,
	authenticate,
	validate(userValidators.deleteAccount),
	userController.deleteAccount,
);

export default router;
