import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminNotificationController } from "../../controllers/admin.notification.controller";
import { adminValidators } from "../../validators/admin.validator";

const router = Router();

router.post(
	"/broadcast",
	validate(adminValidators.broadcastNotification),
	adminNotificationController.broadcast,
);
router.post(
	"/send",
	validate(adminValidators.sendToUsers),
	adminNotificationController.sendToUsers,
);

export default router;
