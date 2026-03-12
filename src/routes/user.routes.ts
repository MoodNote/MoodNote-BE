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

export default router;
