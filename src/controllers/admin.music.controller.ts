import { Request, Response } from "express";
import { adminMusicService } from "../services/admin.music.service";
import { AppError } from "../utils/app-error.util";

const handleError = (error: unknown, res: Response, fallback: string) => {
	if (error instanceof AppError) {
		return res
			.status(error.statusCode)
			.json({ success: false, message: error.message });
	}
	res.status(400).json({
		success: false,
		message: error instanceof Error ? error.message : fallback,
	});
};

export const adminMusicController = {
	// ── Tracks ─────────────────────────────────────────────────────────────

	async createTrack(req: Request, res: Response) {
		try {
			const track = await adminMusicService.createTrack(req.body);
			res.status(201).json({
				success: true,
				message: "Track created successfully",
				data: { track },
			});
		} catch (error) {
			handleError(error, res, "Failed to create track");
		}
	},

	async listTracks(req: Request, res: Response) {
		try {
			const { page, limit, search, genreId } = req.query as Record<
				string,
				string | undefined
			>;

			const result = await adminMusicService.listTracks({
				page: page ? parseInt(page, 10) : 1,
				limit: limit ? parseInt(limit, 10) : 20,
				search,
				genreId,
			});

			res.status(200).json({
				success: true,
				message: "Tracks retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve tracks");
		}
	},

	async getTrack(req: Request, res: Response) {
		try {
			const track = await adminMusicService.getTrack(req.params.id);
			res.status(200).json({
				success: true,
				message: "Track retrieved successfully",
				data: { track },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve track");
		}
	},

	async updateTrack(req: Request, res: Response) {
		try {
			const track = await adminMusicService.updateTrack(
				req.params.id,
				req.body,
			);
			res.status(200).json({
				success: true,
				message: "Track updated successfully",
				data: { track },
			});
		} catch (error) {
			handleError(error, res, "Failed to update track");
		}
	},

	async deleteTrack(req: Request, res: Response) {
		try {
			await adminMusicService.deleteTrack(req.params.id);
			res.status(200).json({
				success: true,
				message: "Track deleted successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to delete track");
		}
	},

	// ── Artists ────────────────────────────────────────────────────────────

	async createArtist(req: Request, res: Response) {
		try {
			const artist = await adminMusicService.createArtist(req.body);
			res.status(201).json({
				success: true,
				message: "Artist created successfully",
				data: { artist },
			});
		} catch (error) {
			handleError(error, res, "Failed to create artist");
		}
	},

	async listArtists(req: Request, res: Response) {
		try {
			const { page, limit, search } = req.query as Record<
				string,
				string | undefined
			>;

			const result = await adminMusicService.listArtists({
				page: page ? parseInt(page, 10) : 1,
				limit: limit ? parseInt(limit, 10) : 20,
				search,
			});

			res.status(200).json({
				success: true,
				message: "Artists retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve artists");
		}
	},

	async getArtist(req: Request, res: Response) {
		try {
			const artist = await adminMusicService.getArtist(req.params.id);
			res.status(200).json({
				success: true,
				message: "Artist retrieved successfully",
				data: { artist },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve artist");
		}
	},

	async updateArtist(req: Request, res: Response) {
		try {
			const artist = await adminMusicService.updateArtist(
				req.params.id,
				req.body,
			);
			res.status(200).json({
				success: true,
				message: "Artist updated successfully",
				data: { artist },
			});
		} catch (error) {
			handleError(error, res, "Failed to update artist");
		}
	},

	async deleteArtist(req: Request, res: Response) {
		try {
			await adminMusicService.deleteArtist(req.params.id);
			res.status(200).json({
				success: true,
				message: "Artist deleted successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to delete artist");
		}
	},

	// ── Genres ─────────────────────────────────────────────────────────────

	async createGenre(req: Request, res: Response) {
		try {
			const genre = await adminMusicService.createGenre(req.body);
			res.status(201).json({
				success: true,
				message: "Genre created successfully",
				data: { genre },
			});
		} catch (error) {
			handleError(error, res, "Failed to create genre");
		}
	},

	async listGenres(req: Request, res: Response) {
		try {
			const { page, limit, search } = req.query as Record<
				string,
				string | undefined
			>;

			const result = await adminMusicService.listGenres({
				page: page ? parseInt(page, 10) : 1,
				limit: limit ? parseInt(limit, 10) : 20,
				search,
			});

			res.status(200).json({
				success: true,
				message: "Genres retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve genres");
		}
	},

	async getGenre(req: Request, res: Response) {
		try {
			const genre = await adminMusicService.getGenre(req.params.id);
			res.status(200).json({
				success: true,
				message: "Genre retrieved successfully",
				data: { genre },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve genre");
		}
	},

	async updateGenre(req: Request, res: Response) {
		try {
			const genre = await adminMusicService.updateGenre(
				req.params.id,
				req.body,
			);
			res.status(200).json({
				success: true,
				message: "Genre updated successfully",
				data: { genre },
			});
		} catch (error) {
			handleError(error, res, "Failed to update genre");
		}
	},

	async deleteGenre(req: Request, res: Response) {
		try {
			await adminMusicService.deleteGenre(req.params.id);
			res.status(200).json({
				success: true,
				message: "Genre deleted successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to delete genre");
		}
	},

	// ── Stats ──────────────────────────────────────────────────────────────

	async getStats(req: Request, res: Response) {
		try {
			const stats = await adminMusicService.getMusicStats();
			res.status(200).json({
				success: true,
				message: "Music stats retrieved successfully",
				data: { stats },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve music stats");
		}
	},
};
