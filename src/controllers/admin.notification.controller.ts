import { Request, Response } from "express";
import { notificationService } from "../services/notification.service";

export const adminNotificationController = {
	async broadcast(req: Request, res: Response) {
		try {
			const { title, message, type, metadata } = req.body;
			const result = await notificationService.broadcastNotification({
				title,
				message,
				type,
				metadata,
			});

			res.status(200).json({
				success: true,
				message: "Notification sent successfully",
				data: result,
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Failed to send notification",
			});
		}
	},

	async sendToUsers(req: Request, res: Response) {
		try {
			const { userIds, title, message, type, metadata } = req.body;
			const result = await notificationService.sendToUsers({
				userIds,
				title,
				message,
				type,
				metadata,
			});

			res.status(200).json({
				success: true,
				message: "Notification sent successfully",
				data: result,
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Failed to send notification",
			});
		}
	},
};
