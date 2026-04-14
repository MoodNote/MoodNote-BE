import { Request, Response } from "express";
import { adminStatsService } from "../services/admin.stats.service";

export const adminStatsController = {
	/**
	 * GET /api/admin/stats/overview
	 * FR-25: System-wide user and content analytics.
	 */
	async getOverview(_req: Request, res: Response) {
		try {
			const data = await adminStatsService.getOverview();
			res.status(200).json({
				success: true,
				message: "Overview statistics retrieved successfully",
				data,
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message:
					error instanceof Error
						? error.message
						: "Failed to retrieve overview statistics",
			});
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
			res.status(200).json({
				success: true,
				message: "Music statistics retrieved successfully",
				data,
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message:
					error instanceof Error
						? error.message
						: "Failed to retrieve music statistics",
			});
		}
	},
};
