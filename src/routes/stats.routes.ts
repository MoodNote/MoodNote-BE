import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { generalRateLimiter } from "../middlewares/rateLimit.middleware";
import { statsController } from "../controllers/stats.controller";
import { statsValidators } from "../validators/stats.validator";

const router = Router();

router.use(generalRateLimiter);
router.use(authenticate);

router.get(
	"/emotion-chart",
	validate(statsValidators.emotionChart),
	statsController.getEmotionChart,
);

router.get(
	"/keywords",
	validate(statsValidators.keywords),
	statsController.getKeywords,
);

router.get(
	"/patterns",
	validate(statsValidators.patterns),
	statsController.getPatterns,
);

export default router;
