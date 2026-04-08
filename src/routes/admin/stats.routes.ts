import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminStatsController } from "../../controllers/admin-stats.controller";
import { statsValidators } from "../../validators/stats.validator";

const router = Router();

router.get("/overview", adminStatsController.getOverview);

router.get(
	"/music",
	validate(statsValidators.adminMusic),
	adminStatsController.getMusicStats,
);

export default router;
