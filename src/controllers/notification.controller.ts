import { Request, Response } from "express";
import { notificationService } from "../services/notification.service";
import { AppError } from "../utils/app-error.util";
import { NotificationType } from "@prisma/client";

const handleError = (error: unknown, res: Response, fallback: string) => {
	if (error instanceof AppError) {
		return res
			.status(error.statusCode)
			.json({ success: false, message: error.message });
	}
	res.status(400).json({
		success: false,
		message: error instanceof Error ? error.message : fallback,
	});
};

export const notificationController = {
	async listNotifications(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const { page, limit, isRead, type } = req.query as Record<
				string,
				string | undefined
			>;

			const result = await notificationService.listNotifications(userId, {
				page: page ? parseInt(page, 10) : 1,
				limit: limit ? parseInt(limit, 10) : 20,
				isRead:
					isRead === "true" ? true : isRead === "false" ? false : undefined,
				type: type as NotificationType | undefined,
			});

			res.status(200).json({
				success: true,
				message: "Notifications retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve notifications");
		}
	},

	async getUnreadCount(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const result = await notificationService.getUnreadCount(userId);

			res.status(200).json({
				success: true,
				message: "Unread count retrieved",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to get unread count");
		}
	},

	async markAsRead(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			await notificationService.markAsRead(userId, id);

			res.status(200).json({
				success: true,
				message: "Notification marked as read",
			});
		} catch (error) {
			handleError(error, res, "Failed to mark notification as read");
		}
	},

	async markAllAsRead(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const result = await notificationService.markAllAsRead(userId);

			res.status(200).json({
				success: true,
				message: "All notifications marked as read",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to mark all as read");
		}
	},

	async deleteNotification(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			await notificationService.deleteNotification(userId, id);

			res.status(200).json({
				success: true,
				message: "Notification deleted successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to delete notification");
		}
	},

	async getSettings(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const settings = await notificationService.getSettings(userId);

			res.status(200).json({
				success: true,
				message: "Notification settings retrieved",
				data: { settings },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve settings");
		}
	},

	async updateSettings(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const { reminderEnabled, reminderTime, reminderDays } = req.body;

			const settings = await notificationService.updateSettings(userId, {
				reminderEnabled,
				reminderTime,
				reminderDays,
			});

			res.status(200).json({
				success: true,
				message: "Notification settings updated",
				data: { settings },
			});
		} catch (error) {
			handleError(error, res, "Failed to update settings");
		}
	},

	async registerDeviceToken(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const { token, platform } = req.body;

			await notificationService.registerDeviceToken(userId, token, platform);

			res.status(200).json({
				success: true,
				message: "Device token registered successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to register device token");
		}
	},

	async removeDeviceToken(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const { token } = req.body;

			await notificationService.removeDeviceToken(userId, token);

			res.status(200).json({
				success: true,
				message: "Device token removed successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to remove device token");
		}
	},
};
