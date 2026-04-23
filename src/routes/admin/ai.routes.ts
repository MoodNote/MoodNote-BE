import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminAiController } from "../../controllers/admin.ai.controller";
import { adminAiValidators } from "../../validators/admin.ai.validator";

const router = Router();

router.get("/health", adminAiController.checkHealth);
router.post("/analyze", validate(adminAiValidators.testAnalyze), adminAiController.testAnalyze);
router.post("/entries/:id/analyze", validate(adminAiValidators.forceAnalyzeEntry), adminAiController.forceAnalyzeEntry);
router.post("/retry-failed", adminAiController.retryFailed);
router.get("/stats", adminAiController.getStats);

export default router;
