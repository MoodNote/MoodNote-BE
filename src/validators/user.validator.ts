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

const deltaOpSchema = z.object({
	insert: z.union([z.string(), z.record(z.string(), z.unknown())]),
	attributes: z.record(z.string(), z.unknown()).optional(),
});

const analysisSchema = z.object({
	primaryEmotion: z.string(),
	sentimentScore: z.number(),
	intensity: z.number(),
	confidence: z.number(),
	emotionDistribution: z.record(z.string(), z.number()),
	keywords: z.array(z.string()),
	analyzedAt: z.string(),
});

const importEntrySchema = z.object({
	entryDate: z.string(),
	createdAt: z.string().optional(),
	inputMethod: z.enum(["TEXT", "VOICE"]).optional().default("TEXT"),
	wordCount: z.number().int().min(0).optional().default(0),
	content: z.object({
		title: z.string().nullable().optional(),
		content: z.object({ ops: z.array(deltaOpSchema) }),
	}).nullable().optional(),
	analysis: analysisSchema.nullable().optional(),
});

export const userValidators = {
	deleteAccount: z.object({
		body: z.object({
			password: z.string().min(1, "Password is required"),
		}),
	}),

	importData: z.object({
		body: z.object({
			entries: z.array(importEntrySchema).optional().default([]),
			settings: z.object({
				theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
				language: z.string().min(2).max(10).optional(),
			}).optional(),
		}),
	}),


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
