import prisma from "../config/database";
import { fcmUtil } from "../utils/fcm.util";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";
import { NotificationType, Prisma } from "@prisma/client";
import { startOfDay, endOfDay } from "../utils/date.util";
import { calcSkip, buildPagination } from "../utils/pagination.util";

interface ListNotificationsOptions {
	page: number;
	limit: number;
	isRead?: boolean;
	type?: NotificationType;
}

interface SendNotificationData {
	title: string;
	message: string;
	type?: NotificationType;
	metadata?: Record<string, unknown>;
}

interface SendToUsersData extends SendNotificationData {
	userIds: string[];
}

class NotificationService {
	async listNotifications(userId: string, opts: ListNotificationsOptions) {
		const { page, limit, isRead, type } = opts;
		const skip = calcSkip(page, limit);

		const where = {
			userId,
			...(isRead !== undefined && { isRead }),
			...(type && { type }),
		};

		const [notifications, total] = await Promise.all([
			prisma.notification.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				select: {
					id: true,
					title: true,
					message: true,
					type: true,
					isRead: true,
					readAt: true,
					metadata: true,
					createdAt: true,
				},
			}),
			prisma.notification.count({ where }),
		]);

		return {
			notifications,
			pagination: buildPagination(total, page, limit),
		};
	}

	async getUnreadCount(userId: string) {
		const count = await prisma.notification.count({
			where: { userId, isRead: false },
		});
		return { count };
	}

	async markAsRead(userId: string, notificationId: string) {
		const notification = await prisma.notification.findFirst({
			where: { id: notificationId, userId },
		});

		if (!notification) {
			throw new AppError("Notification not found", HttpStatus.NOT_FOUND);
		}

		if (notification.isRead) {
			return notification;
		}

		return prisma.notification.update({
			where: { id: notificationId },
			data: { isRead: true, readAt: new Date() },
		});
	}

	async markAllAsRead(userId: string) {
		const result = await prisma.notification.updateMany({
			where: { userId, isRead: false },
			data: { isRead: true, readAt: new Date() },
		});
		return { updated: result.count };
	}

	async deleteNotification(userId: string, notificationId: string) {
		const notification = await prisma.notification.findFirst({
			where: { id: notificationId, userId },
		});

		if (!notification) {
			throw new AppError("Notification not found", HttpStatus.NOT_FOUND);
		}

		await prisma.notification.delete({ where: { id: notificationId } });
	}

	async getSettings(userId: string) {
		return prisma.notificationSettings.upsert({
			where: { userId },
			update: {},
			create: { userId },
		});
	}

	async updateSettings(
		userId: string,
		data: {
			reminderEnabled?: boolean;
			reminderTime?: string;
			reminderDays?: number[];
		},
	) {
		return prisma.notificationSettings.upsert({
			where: { userId },
			update: data,
			create: { userId, ...data },
		});
	}

	async registerDeviceToken(
		userId: string,
		token: string,
		platform?: string,
	) {
		return prisma.deviceToken.upsert({
			where: { token },
			update: { userId, platform },
			create: { userId, token, platform },
		});
	}

	async removeDeviceToken(userId: string, token: string) {
		await prisma.deviceToken.deleteMany({ where: { userId, token } });
	}

	async broadcastNotification(data: SendNotificationData) {
		const users = await prisma.user.findMany({
			where: { isActive: true, isEmailVerified: true },
			select: { id: true },
		});

		if (users.length === 0) {
			throw new AppError("No active users to notify", HttpStatus.NOT_FOUND);
		}

		const type = data.type ?? NotificationType.SYSTEM;

		await prisma.notification.createMany({
			data: users.map((u) => ({
				userId: u.id,
				title: data.title,
				message: data.message,
				type,
				...(data.metadata !== undefined && {
					metadata: data.metadata as Prisma.InputJsonValue,
				}),
			})),
		});

		// Send FCM push notifications
		const userIds = users.map((u) => u.id);
		const deviceTokens = await prisma.deviceToken.findMany({
			where: { userId: { in: userIds } },
			select: { token: true },
		});

		if (deviceTokens.length > 0) {
			const tokens = deviceTokens.map((d: { token: string }) => d.token);
			const staleTokens = await fcmUtil.sendMulticastPush(tokens, data.title, data.message);
			if (staleTokens.length > 0) {
				await prisma.deviceToken
					.deleteMany({ where: { token: { in: staleTokens } } })
					.catch((err: Error) => console.error("[FCM] Failed to clean stale tokens:", err.message));
			}
		}

		return { sent: users.length };
	}

	async sendToUsers(data: SendToUsersData) {
		const { userIds, ...notifData } = data;

		// Filter to only valid active+verified users
		const validUsers = await prisma.user.findMany({
			where: {
				id: { in: userIds },
				isActive: true,
				isEmailVerified: true,
			},
			select: { id: true },
		});

		if (validUsers.length === 0) {
			throw new AppError("No valid users found for the provided IDs", HttpStatus.NOT_FOUND);
		}

		const type = notifData.type ?? NotificationType.SYSTEM;

		await prisma.notification.createMany({
			data: validUsers.map((u) => ({
				userId: u.id,
				title: notifData.title,
				message: notifData.message,
				type,
				...(notifData.metadata !== undefined && {
					metadata: notifData.metadata as Prisma.InputJsonValue,
				}),
			})),
		});

		// Send FCM push notifications
		const validUserIds = validUsers.map((u) => u.id);
		const deviceTokens = await prisma.deviceToken.findMany({
			where: { userId: { in: validUserIds } },
			select: { token: true },
		});

		if (deviceTokens.length > 0) {
			const tokens = deviceTokens.map((d: { token: string }) => d.token);
			const staleTokens = await fcmUtil.sendMulticastPush(tokens, notifData.title, notifData.message);
			if (staleTokens.length > 0) {
				await prisma.deviceToken
					.deleteMany({ where: { token: { in: staleTokens } } })
					.catch((err: Error) => console.error("[FCM] Failed to clean stale tokens:", err.message));
			}
		}

		return { sent: validUsers.length, requested: userIds.length };
	}

	async processReminders() {
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, "0");
		const minutes = String(now.getMinutes()).padStart(2, "0");
		const currentTime = `${hours}:${minutes}`;
		// ISO weekday: 1=Mon ... 7=Sun
		const currentDay = now.getDay() === 0 ? 7 : now.getDay();

		// Find users with reminder settings matching current time + day
		const settings = await prisma.notificationSettings.findMany({
			where: {
				reminderEnabled: true,
				reminderTime: currentTime,
				reminderDays: { has: currentDay },
			},
			select: { userId: true },
		});

		if (settings.length === 0) return;

		const userIds = settings.map((s) => s.userId);
		const todayStart = startOfDay(now);
		const todayEnd = endOfDay(now);

		// Batch both checks — 2 queries instead of O(2n) individual ones
		const [entriesWrittenToday, remindersAlreadySent] = await Promise.all([
			prisma.moodEntry.findMany({
				where: { userId: { in: userIds }, entryDate: { gte: todayStart, lte: todayEnd } },
				select: { userId: true },
			}),
			prisma.notification.findMany({
				where: {
					userId: { in: userIds },
					type: NotificationType.REMINDER,
					createdAt: { gte: todayStart, lte: todayEnd },
				},
				select: { userId: true },
			}),
		]);

		const wroteToday = new Set(entriesWrittenToday.map((e) => e.userId));
		const alreadyNotified = new Set(remindersAlreadySent.map((n) => n.userId));

		const reminderTitle = "Đừng quên viết nhật ký hôm nay 📝";
		const reminderMessage =
			"Hôm nay bạn thế nào? Hãy dành 5 phút chia sẻ với MoodNote nhé 💙";

		const usersToNotify = userIds.filter(
			(id) => !wroteToday.has(id) && !alreadyNotified.has(id),
		);

		if (usersToNotify.length === 0) return;

		await prisma.notification.createMany({
			data: usersToNotify.map((userId) => ({
				userId,
				title: reminderTitle,
				message: reminderMessage,
				type: NotificationType.REMINDER,
			})),
		});

		// Send FCM push
		const deviceTokens = await prisma.deviceToken.findMany({
			where: { userId: { in: usersToNotify } },
			select: { token: true },
		});

		if (deviceTokens.length > 0) {
			const tokens = deviceTokens.map((d: { token: string }) => d.token);
			const staleTokens = await fcmUtil.sendMulticastPush(tokens, reminderTitle, reminderMessage);
			if (staleTokens.length > 0) {
				await prisma.deviceToken
					.deleteMany({ where: { token: { in: staleTokens } } })
					.catch((err: Error) => console.error("[FCM] Failed to clean stale tokens:", err.message));
			}
		}

		console.log(
			`[Reminder] Sent ${usersToNotify.length} reminder(s) at ${currentTime}`,
		);
	}
}

export const notificationService = new NotificationService();
