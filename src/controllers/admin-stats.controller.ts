import { Request, Response } from "express";
import { adminStatsService } from "../services/admin.stats.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const adminStatsController = {
	/**
	 * GET /api/admin/stats/overview
	 * FR-25: System-wide user and content analytics.
	 */
	async getOverview(_req: Request, res: Response) {
		try {
			const data = await adminStatsService.getOverview();
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Overview statistics retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve overview statistics");
		}
	},

	/**
	 * GET /api/admin/stats/music
	 * FR-25: Music analytics — top recommended, top played, genre distribution.
	 */
	async getMusicStats(req: Request, res: Response) {
		try {
			const limit = req.query.limit ? Number(req.query.limit) : 10;
			const data = await adminStatsService.getMusicStats(limit);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Music statistics retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve music statistics");
		}
	},
};
