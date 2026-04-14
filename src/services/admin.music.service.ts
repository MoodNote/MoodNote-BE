import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";
import { handlePrismaError } from "../utils/prisma.util";
import { calcSkip, buildPagination } from "../utils/pagination.util";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CreateTrackInput {
	trackName: string;
	albumName?: string;
	popularity?: number;
	isExplicit?: boolean;
	durationMs?: number;
	danceability?: number;
	energy?: number;
	key?: number;
	loudness?: number;
	speechiness?: number;
	acousticness?: number;
	instrumentalness?: number;
	liveness?: number;
	valence?: number;
	tempo?: number;
	lyrics?: string;
	artistIds: string[];
	genreIds: string[];
}

interface UpdateTrackInput {
	trackName?: string;
	albumName?: string;
	popularity?: number;
	isExplicit?: boolean;
	durationMs?: number;
	danceability?: number;
	energy?: number;
	key?: number;
	loudness?: number;
	speechiness?: number;
	acousticness?: number;
	instrumentalness?: number;
	liveness?: number;
	valence?: number;
	tempo?: number;
	lyrics?: string;
	artistIds?: string[];
	genreIds?: string[];
}

interface ListTracksQuery {
	page: number;
	limit: number;
	search?: string;
	genreId?: string;
}

interface ListQuery {
	page: number;
	limit: number;
	search?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTrack(
	track: Prisma.TrackGetPayload<{
		include: {
			artists: { include: { artist: true } };
			genres: { include: { genre: true } };
		};
	}>,
) {
	return {
		id: track.id,
		trackName: track.trackName,
		albumName: track.albumName,
		popularity: track.popularity,
		isExplicit: track.isExplicit,
		durationMs: track.durationMs,
		danceability: track.danceability,
		energy: track.energy,
		key: track.key,
		loudness: track.loudness,
		speechiness: track.speechiness,
		acousticness: track.acousticness,
		instrumentalness: track.instrumentalness,
		liveness: track.liveness,
		valence: track.valence,
		tempo: track.tempo,
		lyrics: track.lyrics,
		createdAt: track.createdAt,
		updatedAt: track.updatedAt,
		artists: track.artists.map((ta) => ({
			id: ta.artist.id,
			name: ta.artist.name,
			role: ta.role,
		})),
		genres: track.genres.map((tg) => ({
			id: tg.genre.id,
			name: tg.genre.name,
		})),
	};
}

const trackInclude = {
	artists: { include: { artist: true } },
	genres: { include: { genre: true } },
} as const;

// ── Service ────────────────────────────────────────────────────────────────────

export const adminMusicService = {
	// ── Tracks ─────────────────────────────────────────────────────────────

	async createTrack(data: CreateTrackInput) {
		const { artistIds, genreIds, ...trackData } = data;

		// Verify all artistIds exist
		const artists = await prisma.artist.findMany({
			where: { id: { in: artistIds } },
			select: { id: true },
		});
		if (artists.length !== artistIds.length) {
			throw new AppError("One or more artists not found", 404);
		}

		// Verify all genreIds exist (if provided)
		if (genreIds.length > 0) {
			const genres = await prisma.genre.findMany({
				where: { id: { in: genreIds } },
				select: { id: true },
			});
			if (genres.length !== genreIds.length) {
				throw new AppError("One or more genres not found", 404);
			}
		}

		const track = await prisma.$transaction(async (tx) => {
			const created = await tx.track.create({
				data: {
					...trackData,
					artists: {
						create: artistIds.map((artistId) => ({ artistId })),
					},
					genres: {
						create: genreIds.map((genreId) => ({ genreId })),
					},
				},
				include: trackInclude,
			});
			return created;
		});

		return formatTrack(track);
	},

	async listTracks(query: ListTracksQuery) {
		const { page, limit, search, genreId } = query;
		const skip = calcSkip(page, limit);

		const where: Prisma.TrackWhereInput = {
			...(search && {
				OR: [
					{ trackName: { contains: search, mode: "insensitive" } },
					{ albumName: { contains: search, mode: "insensitive" } },
				],
			}),
			...(genreId && { genres: { some: { genreId } } }),
		};

		const [tracks, total] = await Promise.all([
			prisma.track.findMany({
				where,
				include: trackInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.track.count({ where }),
		]);

		return {
			tracks: tracks.map(formatTrack),
			pagination: buildPagination(total, page, limit),
		};
	},

	async getTrack(id: string) {
		const track = await prisma.track.findUnique({
			where: { id },
			include: trackInclude,
		});
		if (!track) throw new AppError("Track not found", 404);
		return formatTrack(track);
	},

	async updateTrack(id: string, data: UpdateTrackInput) {
		const { artistIds, genreIds, ...trackData } = data;

		// Verify exists
		const existing = await prisma.track.findUnique({ where: { id } });
		if (!existing) throw new AppError("Track not found", 404);

		// Verify artistIds if provided
		if (artistIds) {
			const artists = await prisma.artist.findMany({
				where: { id: { in: artistIds } },
				select: { id: true },
			});
			if (artists.length !== artistIds.length) {
				throw new AppError("One or more artists not found", 404);
			}
		}

		// Verify genreIds if provided
		if (genreIds && genreIds.length > 0) {
			const genres = await prisma.genre.findMany({
				where: { id: { in: genreIds } },
				select: { id: true },
			});
			if (genres.length !== genreIds.length) {
				throw new AppError("One or more genres not found", 404);
			}
		}

		const track = await prisma.$transaction(async (tx) => {
			// Replace artists if provided
			if (artistIds) {
				await tx.trackArtist.deleteMany({ where: { trackId: id } });
				await tx.trackArtist.createMany({
					data: artistIds.map((artistId) => ({ trackId: id, artistId })),
				});
			}

			// Replace genres if provided
			if (genreIds !== undefined) {
				await tx.trackGenre.deleteMany({ where: { trackId: id } });
				if (genreIds.length > 0) {
					await tx.trackGenre.createMany({
						data: genreIds.map((genreId) => ({ trackId: id, genreId })),
					});
				}
			}

			return tx.track.update({
				where: { id },
				data: trackData,
				include: trackInclude,
			});
		});

		return formatTrack(track);
	},

	async deleteTrack(id: string) {
		const existing = await prisma.track.findUnique({ where: { id } });
		if (!existing) throw new AppError("Track not found", 404);

		try {
			await prisma.track.delete({ where: { id } });
		} catch (error) {
			handlePrismaError(error);
		}
	},

	// ── Artists ────────────────────────────────────────────────────────────

	async createArtist(data: { name: string }) {
		try {
			const artist = await prisma.artist.create({ data });
			return artist;
		} catch (error) {
			handlePrismaError(error);
		}
	},

	async listArtists(query: ListQuery) {
		const { page, limit, search } = query;
		const skip = calcSkip(page, limit);

		const where: Prisma.ArtistWhereInput = search
			? { name: { contains: search, mode: "insensitive" } }
			: {};

		const [artists, total] = await Promise.all([
			prisma.artist.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take: limit,
				include: { _count: { select: { tracks: true } } },
			}),
			prisma.artist.count({ where }),
		]);

		return {
			artists: artists.map((a) => ({
				id: a.id,
				name: a.name,
				trackCount: a._count.tracks,
				createdAt: a.createdAt,
				updatedAt: a.updatedAt,
			})),
			pagination: buildPagination(total, page, limit),
		};
	},

	async getArtist(id: string) {
		const artist = await prisma.artist.findUnique({
			where: { id },
			include: { _count: { select: { tracks: true } } },
		});
		if (!artist) throw new AppError("Artist not found", 404);
		return {
			id: artist.id,
			name: artist.name,
			trackCount: artist._count.tracks,
			createdAt: artist.createdAt,
			updatedAt: artist.updatedAt,
		};
	},

	async updateArtist(id: string, data: { name: string }) {
		const existing = await prisma.artist.findUnique({ where: { id } });
		if (!existing) throw new AppError("Artist not found", 404);
		try {
			return await prisma.artist.update({ where: { id }, data });
		} catch (error) {
			handlePrismaError(error);
		}
	},

	async deleteArtist(id: string) {
		const existing = await prisma.artist.findUnique({ where: { id } });
		if (!existing) throw new AppError("Artist not found", 404);
		try {
			await prisma.artist.delete({ where: { id } });
		} catch (error) {
			handlePrismaError(error);
		}
	},

	// ── Genres ─────────────────────────────────────────────────────────────

	async createGenre(data: { name: string }) {
		try {
			return await prisma.genre.create({ data });
		} catch (error) {
			handlePrismaError(error);
		}
	},

	async listGenres(query: ListQuery) {
		const { page, limit, search } = query;
		const skip = calcSkip(page, limit);

		const where: Prisma.GenreWhereInput = search
			? { name: { contains: search, mode: "insensitive" } }
			: {};

		const [genres, total] = await Promise.all([
			prisma.genre.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take: limit,
				include: { _count: { select: { tracks: true } } },
			}),
			prisma.genre.count({ where }),
		]);

		return {
			genres: genres.map((g) => ({
				id: g.id,
				name: g.name,
				trackCount: g._count.tracks,
			})),
			pagination: buildPagination(total, page, limit),
		};
	},

	async getGenre(id: string) {
		const genre = await prisma.genre.findUnique({
			where: { id },
			include: { _count: { select: { tracks: true } } },
		});
		if (!genre) throw new AppError("Genre not found", 404);
		return { id: genre.id, name: genre.name, trackCount: genre._count.tracks };
	},

	async updateGenre(id: string, data: { name: string }) {
		const existing = await prisma.genre.findUnique({ where: { id } });
		if (!existing) throw new AppError("Genre not found", 404);
		try {
			return await prisma.genre.update({ where: { id }, data });
		} catch (error) {
			handlePrismaError(error);
		}
	},

	async deleteGenre(id: string) {
		const existing = await prisma.genre.findUnique({ where: { id } });
		if (!existing) throw new AppError("Genre not found", 404);
		try {
			await prisma.genre.delete({ where: { id } });
		} catch (error) {
			handlePrismaError(error);
		}
	},

	// ── Stats ──────────────────────────────────────────────────────────────

	async getMusicStats() {
		const [trackCount, artistCount, genreCount, topGenresRaw] =
			await Promise.all([
				prisma.track.count(),
				prisma.artist.count(),
				prisma.genre.count(),
				// Top genres by track count
				prisma.trackGenre.groupBy({
					by: ["genreId"],
					_count: { trackId: true },
					orderBy: { _count: { trackId: "desc" } },
					take: 10,
				}),
			]);

		// Resolve genre names
		const genreIds = topGenresRaw.map((g) => g.genreId);
		const genres = await prisma.genre.findMany({
			where: { id: { in: genreIds } },
			select: { id: true, name: true },
		});
		const genreMap = Object.fromEntries(genres.map((g) => [g.id, g.name]));

		const topGenres = topGenresRaw.map((g) => ({
			genreId: g.genreId,
			name: genreMap[g.genreId] ?? "Unknown",
			trackCount: g._count.trackId,
		}));

		return {
			totals: { tracks: trackCount, artists: artistCount, genres: genreCount },
			topGenres,
		};
	},
};
