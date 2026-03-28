import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CreateSongInput {
	title: string;
	album?: string;
	year?: number;
	durationSecs?: number;
	moodTags: string[];
	sentimentMin: number;
	sentimentMax: number;
	language?: string;
	popularity?: number;
	artistIds: string[];
	genreIds: string[];
}

interface UpdateSongInput {
	title?: string;
	album?: string;
	year?: number;
	durationSecs?: number;
	moodTags?: string[];
	sentimentMin?: number;
	sentimentMax?: number;
	language?: string;
	popularity?: number;
	artistIds?: string[];
	genreIds?: string[];
}

interface ListSongsQuery {
	page: number;
	limit: number;
	search?: string;
	genreId?: string;
	moodTag?: string;
	language?: string;
}

interface ListQuery {
	page: number;
	limit: number;
	search?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function handlePrismaError(error: unknown): never {
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		if (error.code === "P2002") {
			throw new AppError("Name already exists", 409);
		}
		if (error.code === "P2025") {
			throw new AppError("Record not found", 404);
		}
		if (error.code === "P2003" || error.code === "P2014") {
			throw new AppError(
				"Cannot delete: record is referenced by other data",
				409,
			);
		}
	}
	throw error;
}

function formatSong(
	song: Prisma.SongGetPayload<{
		include: {
			artists: { include: { artist: true } };
			genres: { include: { genre: true } };
		};
	}>,
) {
	return {
		id: song.id,
		title: song.title,
		album: song.album,
		year: song.year,
		durationSecs: song.durationSecs,
		moodTags: song.moodTags,
		sentimentMin: song.sentimentMin,
		sentimentMax: song.sentimentMax,
		language: song.language,
		popularity: song.popularity,
		createdAt: song.createdAt,
		updatedAt: song.updatedAt,
		artists: song.artists.map((sa) => ({
			id: sa.artist.id,
			name: sa.artist.name,
			role: sa.role,
		})),
		genres: song.genres.map((sg) => ({
			id: sg.genre.id,
			name: sg.genre.name,
		})),
	};
}

const songInclude = {
	artists: { include: { artist: true } },
	genres: { include: { genre: true } },
} as const;

// ── Service ────────────────────────────────────────────────────────────────────

export const adminMusicService = {
	// ── Songs ──────────────────────────────────────────────────────────────

	async createSong(data: CreateSongInput) {
		const { artistIds, genreIds, ...songData } = data;

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

		const song = await prisma.$transaction(async (tx) => {
			const created = await tx.song.create({
				data: {
					...songData,
					popularity: songData.popularity ?? 0,
					artists: {
						create: artistIds.map((artistId) => ({ artistId })),
					},
					genres: {
						create: genreIds.map((genreId) => ({ genreId })),
					},
				},
				include: songInclude,
			});
			return created;
		});

		return formatSong(song);
	},

	async listSongs(query: ListSongsQuery) {
		const { page, limit, search, genreId, moodTag, language } = query;
		const skip = (page - 1) * limit;

		const where: Prisma.SongWhereInput = {
			...(search && {
				OR: [
					{ title: { contains: search, mode: "insensitive" } },
					{ album: { contains: search, mode: "insensitive" } },
				],
			}),
			...(moodTag && { moodTags: { has: moodTag } }),
			...(language && { language: { equals: language, mode: "insensitive" } }),
			...(genreId && { genres: { some: { genreId } } }),
		};

		const [songs, total] = await Promise.all([
			prisma.song.findMany({
				where,
				include: songInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.song.count({ where }),
		]);

		return {
			songs: songs.map(formatSong),
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	async getSong(id: string) {
		const song = await prisma.song.findUnique({
			where: { id },
			include: songInclude,
		});
		if (!song) throw new AppError("Song not found", 404);
		return formatSong(song);
	},

	async updateSong(id: string, data: UpdateSongInput) {
		const { artistIds, genreIds, ...songData } = data;

		// Verify exists
		const existing = await prisma.song.findUnique({ where: { id } });
		if (!existing) throw new AppError("Song not found", 404);

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

		const song = await prisma.$transaction(async (tx) => {
			// Replace artists if provided
			if (artistIds) {
				await tx.songArtist.deleteMany({ where: { songId: id } });
				await tx.songArtist.createMany({
					data: artistIds.map((artistId) => ({ songId: id, artistId })),
				});
			}

			// Replace genres if provided
			if (genreIds !== undefined) {
				await tx.songGenre.deleteMany({ where: { songId: id } });
				if (genreIds.length > 0) {
					await tx.songGenre.createMany({
						data: genreIds.map((genreId) => ({ songId: id, genreId })),
					});
				}
			}

			return tx.song.update({
				where: { id },
				data: songData,
				include: songInclude,
			});
		});

		return formatSong(song);
	},

	async deleteSong(id: string) {
		const existing = await prisma.song.findUnique({ where: { id } });
		if (!existing) throw new AppError("Song not found", 404);

		try {
			await prisma.song.delete({ where: { id } });
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
		const skip = (page - 1) * limit;

		const where: Prisma.ArtistWhereInput = search
			? { name: { contains: search, mode: "insensitive" } }
			: {};

		const [artists, total] = await Promise.all([
			prisma.artist.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take: limit,
				include: { _count: { select: { songs: true } } },
			}),
			prisma.artist.count({ where }),
		]);

		return {
			artists: artists.map((a) => ({
				id: a.id,
				name: a.name,
				songCount: a._count.songs,
				createdAt: a.createdAt,
				updatedAt: a.updatedAt,
			})),
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	async getArtist(id: string) {
		const artist = await prisma.artist.findUnique({
			where: { id },
			include: { _count: { select: { songs: true } } },
		});
		if (!artist) throw new AppError("Artist not found", 404);
		return {
			id: artist.id,
			name: artist.name,
			songCount: artist._count.songs,
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
		const skip = (page - 1) * limit;

		const where: Prisma.GenreWhereInput = search
			? { name: { contains: search, mode: "insensitive" } }
			: {};

		const [genres, total] = await Promise.all([
			prisma.genre.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take: limit,
				include: { _count: { select: { songs: true } } },
			}),
			prisma.genre.count({ where }),
		]);

		return {
			genres: genres.map((g) => ({
				id: g.id,
				name: g.name,
				songCount: g._count.songs,
			})),
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	async getGenre(id: string) {
		const genre = await prisma.genre.findUnique({
			where: { id },
			include: { _count: { select: { songs: true } } },
		});
		if (!genre) throw new AppError("Genre not found", 404);
		return { id: genre.id, name: genre.name, songCount: genre._count.songs };
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
		const [songCount, artistCount, genreCount, topGenresRaw, topMoodTagsRaw] =
			await Promise.all([
				prisma.song.count(),
				prisma.artist.count(),
				prisma.genre.count(),
				// Top genres by song count
				prisma.songGenre.groupBy({
					by: ["genreId"],
					_count: { songId: true },
					orderBy: { _count: { songId: "desc" } },
					take: 10,
				}),
				// Top mood tags via raw SQL (PostgreSQL unnest on array column)
				prisma.$queryRaw<{ tag: string; count: bigint }[]>`
					SELECT unnest(mood_tags) AS tag, COUNT(*) AS count
					FROM songs
					GROUP BY tag
					ORDER BY count DESC
					LIMIT 10
				`,
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
			songCount: g._count.songId,
		}));

		const topMoodTags = topMoodTagsRaw.map((row) => ({
			tag: row.tag,
			count: Number(row.count),
		}));

		return {
			totals: { songs: songCount, artists: artistCount, genres: genreCount },
			topGenres,
			topMoodTags,
		};
	},
};
