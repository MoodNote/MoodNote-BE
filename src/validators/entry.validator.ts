import { z } from "zod";

const deltaOpSchema = z.object({
	insert: z.union([z.string(), z.record(z.string(), z.unknown())]),
	attributes: z.record(z.string(), z.unknown()).optional(),
});

const deltaSchema = z.object({
	ops: z
		.array(deltaOpSchema)
		.min(1, "Content must have at least one operation"),
});

const extractPlainText = (delta: z.infer<typeof deltaSchema>): string =>
	delta.ops
		.filter((op) => typeof op.insert === "string")
		.map((op) => op.insert as string)
		.join("")
		.trim();

const tagSchema = z
	.string()
	.min(1, "Tag cannot be empty")
	.max(30, "Tag must be at most 30 characters");

export const entryValidators = {
	createEntry: z.object({
		body: z
			.object({
				title: z
					.string()
					.max(100, "Title must be at most 100 characters")
					.optional(),
				content: deltaSchema,
				entryDate: z
					.string()
					.optional()
					.refine(
						(val) => {
							if (!val) return true;
							const date = new Date(val);
							return !isNaN(date.getTime());
						},
						{ message: "Invalid date format" },
					)
					.refine(
						(val) => {
							if (!val) return true;
							const date = new Date(val);
							const today = new Date();
							today.setHours(23, 59, 59, 999);
							return date <= today;
						},
						{ message: "Entry date cannot be in the future" },
					),
				inputMethod: z
					.enum(["TEXT", "VOICE"])
					.optional()
					.default("TEXT"),
				tags: z
					.array(tagSchema)
					.max(10, "Cannot have more than 10 tags")
					.optional()
					.default([]),
				isPrivate: z.boolean().optional().default(false),
			})
			.superRefine((data, ctx) => {
				const plainText = extractPlainText(data.content);
				if (plainText.length < 10) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Content must be at least 10 characters",
						path: ["content"],
					});
				}
				if (plainText.length > 5000) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Content must be at most 5000 characters",
						path: ["content"],
					});
				}
			}),
	}),

	listEntries: z.object({
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
				.pipe(
					z
						.number()
						.min(1)
						.max(100, "Limit must be between 1 and 100"),
				),
			startDate: z
				.string()
				.optional()
				.refine((val) => !val || !isNaN(new Date(val).getTime()), {
					message: "Invalid startDate format",
				}),
			endDate: z
				.string()
				.optional()
				.refine((val) => !val || !isNaN(new Date(val).getTime()), {
					message: "Invalid endDate format",
				}),
			tags: z.string().optional(),
			analysisStatus: z
				.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"])
				.optional(),
		}),
	}),

	bulkDeleteEntries: z.object({
		body: z.object({
			ids: z
				.array(z.string().uuid("Each id must be a valid UUID"))
				.min(1, "At least one id is required")
				.max(100, "Cannot delete more than 100 entries at once"),
		}),
	}),

	updateEntry: z.object({
		body: z
			.object({
				title: z
					.string()
					.max(100, "Title must be at most 100 characters")
					.optional(),
				content: deltaSchema.optional(),
				tags: z
					.array(tagSchema)
					.max(10, "Cannot have more than 10 tags")
					.optional(),
				isPrivate: z.boolean().optional(),
			})
			.superRefine((data, ctx) => {
				// At least one field must be provided
				if (
					data.title === undefined &&
					data.content === undefined &&
					data.tags === undefined &&
					data.isPrivate === undefined
				) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "No fields to update",
					});
				}
				// Validate content length if content provided
				if (data.content) {
					const plainText = extractPlainText(data.content);
					if (plainText.length < 10) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: "Content must be at least 10 characters",
							path: ["content"],
						});
					}
					if (plainText.length > 5000) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: "Content must be at most 5000 characters",
							path: ["content"],
						});
					}
				}
			}),
	}),
};
