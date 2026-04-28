import { z } from "zod";

const paginationQuery = {
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
};

const idParam = z.object({
	params: z.object({
		id: z.string().uuid("ID must be a valid UUID"),
	}),
});

const tagTypeEnum = z.enum(["MOOD", "LIFE"]);

export const adminMoodTagsValidators = {
	byId: idParam,

	createTag: z.object({
		body: z.object({
			name: z
				.string()
				.min(1, "Tag name is required")
				.max(50, "Tag name must be at most 50 characters")
				.trim(),
			color: z
				.string()
				.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color (e.g. #6B7280)")
				.optional(),
			type: tagTypeEnum,
		}),
	}),

	updateTag: idParam.extend({
		body: z
			.object({
				name: z
					.string()
					.min(1, "Tag name is required")
					.max(50, "Tag name must be at most 50 characters")
					.trim()
					.optional(),
				color: z
					.string()
					.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color (e.g. #6B7280)")
					.nullable()
					.optional(),
				type: tagTypeEnum.optional(),
			})
			.superRefine((data, ctx) => {
				if (data.name === undefined && data.color === undefined && data.type === undefined) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "At least one field (name, color, or type) is required",
					});
				}
			}),
	}),

	listTags: z.object({
		query: z.object({
			...paginationQuery,
			type: tagTypeEnum.optional(),
		}),
	}),
};
