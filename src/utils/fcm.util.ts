import admin from "../config/firebase.config";
import prisma from "../config/database";

const isFirebaseReady = () => admin.apps.length > 0;

export const fcmUtil = {
	/**
	 * Send push notification to a single device token.
	 * Returns true on success, false if token is stale/invalid.
	 */
	async sendPushNotification(
		token: string,
		title: string,
		message: string,
		data?: Record<string, string>,
	): Promise<boolean> {
		if (!isFirebaseReady()) return false;

		try {
			await admin.messaging().send({
				token,
				notification: { title, body: message },
				data,
				android: { priority: "high" },
			});
			return true;
		} catch (error: any) {
			if (
				error.code === "messaging/registration-token-not-registered" ||
				error.code === "messaging/invalid-registration-token"
			) {
				return false; // stale token
			}
			console.error("[FCM] sendPushNotification error:", error.message);
			return false;
		}
	},

	/**
	 * Send push notification to multiple tokens (batches of 500 per FCM limit).
	 * Returns array of stale tokens that should be removed from DB.
	 */
	async sendMulticastPush(
		tokens: string[],
		title: string,
		message: string,
		data?: Record<string, string>,
	): Promise<string[]> {
		if (!isFirebaseReady() || tokens.length === 0) return [];

		const staleTokens: string[] = [];
		const batchSize = 500;

		for (let i = 0; i < tokens.length; i += batchSize) {
			const batch = tokens.slice(i, i + batchSize);
			try {
				const response = await admin.messaging().sendEachForMulticast({
					tokens: batch,
					notification: { title, body: message },
					data,
					android: { priority: "high" },
				});

				response.responses.forEach((res, idx) => {
					if (
						!res.success &&
						res.error &&
						(res.error.code ===
							"messaging/registration-token-not-registered" ||
							res.error.code ===
								"messaging/invalid-registration-token")
					) {
						staleTokens.push(batch[idx]);
					}
				});
			} catch (error: any) {
				console.error("[FCM] sendMulticastPush batch error:", error.message);
			}
		}

		// Clean up stale tokens from DB
		if (staleTokens.length > 0) {
			await prisma.deviceToken
				.deleteMany({ where: { token: { in: staleTokens } } })
				.catch((err: Error) =>
					console.error("[FCM] Failed to clean stale tokens:", err.message),
				);
		}

		return staleTokens;
	},
};
