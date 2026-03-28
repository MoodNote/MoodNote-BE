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

const songBodyBase = {
	title: z.string().min(1, "Title is required").max(200),
	album: z.string().max(200).optional(),
	year: z
		.number()
		.int()
		.min(1900)
		.max(new Date().getFullYear() + 1)
		.optional(),
	durationSecs: z.number().int().min(1).optional(),
	moodTags: z
		.array(z.string().min(1).max(50))
		.min(1, "At least one mood tag is required"),
	sentimentMin: z.number().min(-1.0).max(1.0),
	sentimentMax: z.number().min(-1.0).max(1.0),
	language: z.string().max(10).optional(),
	popularity: z.number().int().min(0).max(100).optional().default(0),
	artistIds: z.array(z.string().uuid()).min(1, "At least one artist is required"),
	genreIds: z.array(z.string().uuid()).default([]),
};

export const adminMusicValidators = {
	// ── Songs ──────────────────────────────────────────────────────

	createSong: z.object({
		body: z
			.object(songBodyBase)
			.superRefine((data, ctx) => {
				if (data.sentimentMin >= data.sentimentMax) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "sentimentMin must be less than sentimentMax",
						path: ["sentimentMin"],
					});
				}
			}),
	}),

	updateSong: z.object({
		body: z
			.object({
				title: z.string().min(1).max(200).optional(),
				album: z.string().max(200).optional(),
				year: z
					.number()
					.int()
					.min(1900)
					.max(new Date().getFullYear() + 1)
					.optional(),
				durationSecs: z.number().int().min(1).optional(),
				moodTags: z
					.array(z.string().min(1).max(50))
					.min(1, "At least one mood tag is required")
					.optional(),
				sentimentMin: z.number().min(-1.0).max(1.0).optional(),
				sentimentMax: z.number().min(-1.0).max(1.0).optional(),
				language: z.string().max(10).optional(),
				popularity: z.number().int().min(0).max(100).optional(),
				artistIds: z
					.array(z.string().uuid())
					.min(1, "At least one artist is required")
					.optional(),
				genreIds: z.array(z.string().uuid()).optional(),
			})
			.superRefine((data, ctx) => {
				if (Object.keys(data).length === 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "No fields to update",
					});
				}
				if (
					data.sentimentMin !== undefined &&
					data.sentimentMax !== undefined &&
					data.sentimentMin >= data.sentimentMax
				) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "sentimentMin must be less than sentimentMax",
						path: ["sentimentMin"],
					});
				}
			}),
	}),

	listSongs: z.object({
		query: z.object({
			...paginationQuery,
			genreId: z.string().uuid().optional(),
			moodTag: z.string().optional(),
			language: z.string().optional(),
		}),
	}),

	// ── Artists ────────────────────────────────────────────────────

	createArtist: z.object({
		body: z.object({
			name: z.string().min(1, "Name is required").max(200),
		}),
	}),

	updateArtist: z.object({
		body: z.object({
			name: z.string().min(1, "Name is required").max(200),
		}),
	}),

	listArtists: z.object({
		query: z.object({ ...paginationQuery }),
	}),

	// ── Genres ─────────────────────────────────────────────────────

	createGenre: z.object({
		body: z.object({
			name: z.string().min(1, "Name is required").max(100),
		}),
	}),

	updateGenre: z.object({
		body: z.object({
			name: z.string().min(1, "Name is required").max(100),
		}),
	}),

	listGenres: z.object({
		query: z.object({ ...paginationQuery }),
	}),
};
