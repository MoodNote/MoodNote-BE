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

const trackBodyBase = {
	trackName: z.string().min(1, "Track name is required").max(300),
	albumName: z.string().max(300).optional(),
	popularity: z.number().int().min(0).max(100).optional(),
	isExplicit: z.boolean().optional().default(false),
	durationMs: z.number().int().min(1).optional(),
	danceability: z.number().min(0).max(1).optional(),
	energy: z.number().min(0).max(1).optional(),
	key: z.number().int().min(0).max(11).optional(),
	loudness: z.number().optional(),
	speechiness: z.number().min(0).max(1).optional(),
	acousticness: z.number().min(0).max(1).optional(),
	instrumentalness: z.number().min(0).max(1).optional(),
	liveness: z.number().min(0).max(1).optional(),
	valence: z.number().min(0).max(1).optional(),
	tempo: z.number().optional(),
	lyrics: z.string().optional(),
	artistIds: z
		.array(z.string().uuid())
		.min(1, "At least one artist is required"),
	genreIds: z.array(z.string().uuid()).default([]),
};

export const adminMusicValidators = {
	// ── Tracks ─────────────────────────────────────────────────────────

	createTrack: z.object({
		body: z.object(trackBodyBase),
	}),

	updateTrack: z.object({
		body: z
			.object({
				trackName: z.string().min(1).max(300).optional(),
				albumName: z.string().max(300).optional(),
				popularity: z.number().int().min(0).max(100).optional(),
				isExplicit: z.boolean().optional(),
				durationMs: z.number().int().min(1).optional(),
				danceability: z.number().min(0).max(1).optional(),
				energy: z.number().min(0).max(1).optional(),
				key: z.number().int().min(0).max(11).optional(),
				loudness: z.number().optional(),
				speechiness: z.number().min(0).max(1).optional(),
				acousticness: z.number().min(0).max(1).optional(),
				instrumentalness: z.number().min(0).max(1).optional(),
				liveness: z.number().min(0).max(1).optional(),
				valence: z.number().min(0).max(1).optional(),
				tempo: z.number().optional(),
				lyrics: z.string().optional(),
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
			}),
	}),

	listTracks: z.object({
		query: z.object({
			...paginationQuery,
			genreId: z.string().uuid().optional(),
		}),
	}),

	// ── Artists ────────────────────────────────────────────────────────

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

	// ── Genres ─────────────────────────────────────────────────────────

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
