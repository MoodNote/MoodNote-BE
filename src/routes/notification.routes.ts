import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { generalRateLimiter } from "../middlewares/rateLimit.middleware";
import { notificationController } from "../controllers/notification.controller";
import { notificationValidators } from "../validators/notification.validator";

const router = Router();

router.use(generalRateLimiter);
router.use(authenticate);

router.get(
	"/",
	validate(notificationValidators.listNotifications),
	notificationController.listNotifications,
);
router.get("/unread-count", notificationController.getUnreadCount);
router.get("/settings", notificationController.getSettings);

// Static routes BEFORE dynamic /:id routes
router.patch("/read-all", notificationController.markAllAsRead);
router.patch(
	"/settings",
	validate(notificationValidators.updateSettings),
	notificationController.updateSettings,
);
router.post(
	"/device-token",
	validate(notificationValidators.registerDeviceToken),
	notificationController.registerDeviceToken,
);
router.delete(
	"/device-token",
	validate(notificationValidators.removeDeviceToken),
	notificationController.removeDeviceToken,
);

// Dynamic routes
router.patch(
	"/:id/read",
	validate(notificationValidators.markRead),
	notificationController.markAsRead,
);
router.delete(
	"/:id",
	validate(notificationValidators.deleteNotification),
	notificationController.deleteNotification,
);

export default router;
