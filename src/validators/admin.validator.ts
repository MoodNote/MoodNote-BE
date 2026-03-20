import { z } from "zod";

export const adminValidators = {
	adminLogin: z.object({
		body: z.object({
			email: z.string().email("Invalid email format"),
			password: z.string().min(1, "Password is required"),
		}),
	}),

	broadcastNotification: z.object({
		body: z.object({
			title: z
				.string()
				.min(1, "Title is required")
				.max(100, "Title must be at most 100 characters")
				.trim(),
			message: z
				.string()
				.min(1, "Message is required")
				.max(1000, "Message must be at most 1000 characters")
				.trim(),
			type: z.enum(["SYSTEM"]).optional().default("SYSTEM"),
			metadata: z.record(z.string(), z.unknown()).optional(),
		}),
	}),

	sendToUsers: z.object({
		body: z.object({
			userIds: z
				.array(z.string().uuid("Each userId must be a valid UUID"))
				.min(1, "At least one userId is required")
				.max(500, "Cannot send to more than 500 users at once"),
			title: z
				.string()
				.min(1, "Title is required")
				.max(100, "Title must be at most 100 characters")
				.trim(),
			message: z
				.string()
				.min(1, "Message is required")
				.max(1000, "Message must be at most 1000 characters")
				.trim(),
			type: z.enum(["SYSTEM"]).optional().default("SYSTEM"),
			metadata: z.record(z.string(), z.unknown()).optional(),
		}),
	}),

	listUsers: z.object({
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
			search: z.string().optional(),
			isActive: z
				.enum(["true", "false"])
				.optional()
				.transform((val) =>
					val === "true" ? true : val === "false" ? false : undefined,
				),
		}),
	}),
};
