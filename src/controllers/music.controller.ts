import { Request, Response } from "express";
import { musicService } from "../services/music.service";
import { HttpStatus } from "../utils/http-status.util";

export const musicController = {
	async getRecommendation(req: Request, res: Response) {
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
	},

	async refreshRecommendation(req: Request, res: Response) {
		const recommendation = await musicService.refreshRecommendation(
			req.user!.userId,
			req.params.entryId,
		);
		res.status(HttpStatus.OK).json({
			success: true,
			message: "Recommendation refreshed successfully",
			data: { recommendation },
		});
	},

	async getRecentRecommendation(req: Request, res: Response) {
		const data = await musicService.getRecentRecommendation(
			req.user!.userId,
			Number(req.query.limit) || 5,
		);
		res.status(HttpStatus.OK).json({
			success: true,
			message: "Recent playlists retrieved successfully",
			data,
		});
	},
};
