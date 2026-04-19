import { Request, Response } from "express";
import { musicService } from "../services/music.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const musicController = {
	/**
	 * GET /api/music/entries/:entryId/recommendation
	 * Returns cached recommendation or generates a new one.
	 */
	async getRecommendation(req: Request, res: Response) {
		try {
			const recommendation = await musicService.getOrCreateRecommendation(
				req.user!.userId,
				req.params.entryId,
			);
			if (!recommendation) {
				return res.status(HttpStatus.ACCEPTED).json({
					success: true,
					message: "Recommendation is being prepared, please try again shortly",
					data: null,
				});
			}
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Recommendation retrieved successfully",
				data: { recommendation },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve recommendation");
		}
	},

	/**
	 * POST /api/music/entries/:entryId/recommendation/refresh
	 * Force-regenerates with jitter, overwriting cached recommendation.
	 */
	async refreshRecommendation(req: Request, res: Response) {
		try {
			const recommendation = await musicService.refreshRecommendation(
				req.user!.userId,
				req.params.entryId,
			);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Recommendation refreshed successfully",
				data: { recommendation },
			});
		} catch (error) {
			handleError(error, res, "Failed to refresh recommendation");
		}
	},

	/**
	 * GET /api/music/recent
	 * Returns the most recent recommendation with limited tracks (for home screen).
	 */
	async getRecentRecommendation(req: Request, res: Response) {
		try {
			const data = await musicService.getRecentRecommendation(
				req.user!.userId,
				Number(req.query.limit) || 5,
			);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Recent recommendation retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve recent recommendation");
		}
	},
};
