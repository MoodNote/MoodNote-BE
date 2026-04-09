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

router.get(
	"/summary",
	validate(statsValidators.summary),
	statsController.getSummary,
);

router.get(
	"/weekly",
	validate(statsValidators.weekly),
	statsController.getWeeklyChart,
);

router.get(
	"/monthly-calendar",
	validate(statsValidators.monthlyCalendar),
	statsController.getMonthlyCalendar,
);

export default router;
