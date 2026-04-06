import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { generalRateLimiter } from "../middlewares/rateLimit.middleware";
import { musicController } from "../controllers/music.controller";
import { musicValidators } from "../validators/music.validator";

const router = Router();

router.use(generalRateLimiter);
router.use(authenticate);

router.get(
	"/entries/:entryId/recommendation",
	validate(musicValidators.getRecommendation),
	musicController.getRecommendation,
);

router.post(
	"/entries/:entryId/recommendation/refresh",
	validate(musicValidators.refreshRecommendation),
	musicController.refreshRecommendation,
);

export default router;
