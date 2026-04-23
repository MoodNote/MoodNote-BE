import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminNotificationController } from "../../controllers/admin.notification.controller";
import { adminValidators } from "../../validators/admin.validator";
import { broadcastRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

router.post(
	"/broadcast",
	broadcastRateLimiter,
	validate(adminValidators.broadcastNotification),
	adminNotificationController.broadcast,
);
router.post(
	"/send",
	broadcastRateLimiter,
	validate(adminValidators.sendToUsers),
	adminNotificationController.sendToUsers,
);

export default router;
