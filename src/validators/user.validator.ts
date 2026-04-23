import { z } from "zod";

const usernameSchema = z
	.string()
	.min(3, "Username must be at least 3 characters")
	.max(30, "Username must be at most 30 characters")
	.regex(
		/^[a-z0-9_]+$/,
		"Username can only contain lowercase letters, numbers, and underscores",
	)
	.toLowerCase()
	.trim();

export const userValidators = {
	updateProfile: z.object({
		body: z
			.object({
				name: z
					.string()
					.min(2, "Name must be at least 2 characters")
					.max(50, "Name must be at most 50 characters")
					.trim()
					.optional(),
				username: usernameSchema.optional(),
			})
			.refine(
				(data) =>
					data.name !== undefined || data.username !== undefined,
				{
					message:
						"At least one field (name or username) is required",
				},
			),
	}),

	updateSettings: z.object({
		body: z
			.object({
				theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
				language: z
					.string()
					.min(2, "Language code must be at least 2 characters")
					.max(10, "Language code must be at most 10 characters")
					.optional(),
			})
			.refine((data) => data.theme !== undefined || data.language !== undefined, {
				message: "At least one field (theme or language) is required",
			}),
	}),
};
