import { z } from "zod";

const dateFields = {
	range: z.enum(["7", "14", "30", "90"]).optional().default("30"),
	startDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
		.optional(),
	endDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
		.optional(),
};

const dateRangeRefine = (data: {
	startDate?: string;
	endDate?: string;
}) => {
	if (data.startDate && data.endDate) {
		return new Date(data.startDate) <= new Date(data.endDate);
	}
	return true;
};

export const statsValidators = {
	emotionChart: z.object({
		query: z
			.object(dateFields)
			.refine(dateRangeRefine, {
				message: "startDate must be before or equal to endDate",
			}),
	}),

	keywords: z.object({
		query: z
			.object({
				...dateFields,
				limit: z.coerce.number().int().min(1).max(20).optional().default(10),
			})
			.refine(dateRangeRefine, {
				message: "startDate must be before or equal to endDate",
			}),
	}),

	patterns: z.object({
		query: z.object({
			range: z.enum(["30", "60", "90"]).optional().default("30"),
		}),
	}),

	adminMusic: z.object({
		query: z.object({
			limit: z.coerce.number().int().min(1).max(20).optional().default(10),
		}),
	}),
};
