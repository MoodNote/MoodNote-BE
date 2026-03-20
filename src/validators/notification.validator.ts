import { z } from "zod";

export const notificationValidators = {
	listNotifications: z.object({
		query: z.object({
			page: z
				.string()
				.optional()
				.transform((val) => (val ? parseInt(val, 10) : 1))
				.pipe(z.number().min(1, "Page must be at least 1")),
			limit: z
				.string()
				.optional()
				.transform((val) => (val ? parseInt(val, 10) : 20))
				.pipe(z.number().min(1).max(100, "Limit must be between 1 and 100")),
			isRead: z
				.enum(["true", "false"])
				.optional()
				.transform((val) =>
					val === "true" ? true : val === "false" ? false : undefined,
				),
			type: z.enum(["SYSTEM", "REMINDER", "STREAK"]).optional(),
		}),
	}),

	markRead: z.object({
		params: z.object({
			id: z.string().uuid("Invalid notification ID"),
		}),
	}),

	deleteNotification: z.object({
		params: z.object({
			id: z.string().uuid("Invalid notification ID"),
		}),
	}),

	updateSettings: z.object({
		body: z
			.object({
				reminderEnabled: z.boolean().optional(),
				reminderTime: z
					.string()
					.regex(
						/^([01]\d|2[0-3]):([0-5]\d)$/,
						"reminderTime must be in HH:mm format (e.g., 21:00)",
					)
					.optional(),
				reminderDays: z
					.array(
						z
							.number()
							.int()
							.min(1, "Day must be between 1 (Mon) and 7 (Sun)")
							.max(7, "Day must be between 1 (Mon) and 7 (Sun)"),
					)
					.min(1, "At least one day must be selected")
					.max(7)
					.optional(),
			})
			.superRefine((data, ctx) => {
				if (
					data.reminderEnabled === undefined &&
					data.reminderTime === undefined &&
					data.reminderDays === undefined
				) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "At least one field must be provided",
					});
				}
			}),
	}),

	registerDeviceToken: z.object({
		body: z.object({
			token: z.string().min(1, "Device token is required"),
			platform: z.enum(["android", "ios"]).optional(),
		}),
	}),

	removeDeviceToken: z.object({
		body: z.object({
			token: z.string().min(1, "Device token is required"),
		}),
	}),
};
