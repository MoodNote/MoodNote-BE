import { z } from "zod";

const entryIdParam = z.object({
	params: z.object({
		entryId: z.string().uuid("entryId must be a valid UUID"),
	}),
});

export const musicValidators = {
	getRecommendation: entryIdParam,
	refreshRecommendation: entryIdParam,
};
