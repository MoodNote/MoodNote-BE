import { Request, Response } from "express";
import { statsService } from "../services/stats.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const statsController = {
	/**
	 * GET /api/stats/emotion-chart
	 * FR-18: Sentiment score trend over time.
	 */
	async getEmotionChart(req: Request, res: Response) {
		try {
			const data = await statsService.getEmotionChart(req.user!.userId, {
				range: req.query.range as string | undefined,
				startDate: req.query.startDate as string | undefined,
				endDate: req.query.endDate as string | undefined,
			});
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Emotion chart data retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve emotion chart");
		}
	},

	/**
	 * GET /api/stats/keywords
	 * FR-19: Top keywords by frequency.
	 */
	async getKeywords(req: Request, res: Response) {
		try {
			const data = await statsService.getKeywords(req.user!.userId, {
				range: req.query.range as string | undefined,
				startDate: req.query.startDate as string | undefined,
				endDate: req.query.endDate as string | undefined,
				limit: req.query.limit ? Number(req.query.limit) : undefined,
			});
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Keywords retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve keywords");
		}
	},

	/**
	 * GET /api/stats/patterns
	 * FR-20: Emotion frequency by day of week and time of day (simplified).
	 */
	async getPatterns(req: Request, res: Response) {
		try {
			const data = await statsService.getPatterns(req.user!.userId, {
				range: req.query.range as string | undefined,
			});
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Patterns retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve patterns");
		}
	},

	/**
	 * GET /api/stats/summary
	 * Home screen streaks: writingStreak, smileStreak, sadStreak.
	 */
	async getSummary(req: Request, res: Response) {
		try {
			const data = await statsService.getSummary(req.user!.userId);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Summary retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve summary");
		}
	},

	/**
	 * GET /api/stats/weekly
	 * Báo cáo: 7-day emotion chart with Vietnamese day labels.
	 */
	async getWeeklyChart(req: Request, res: Response) {
		try {
			const data = await statsService.getWeeklyChart(req.user!.userId, {
				startDate: req.query.startDate as string | undefined,
			});
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Weekly chart retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve weekly chart");
		}
	},

	/**
	 * GET /api/stats/monthly-calendar
	 * Báo cáo: All days in a month with emotion per day.
	 */
	async getMonthlyCalendar(req: Request, res: Response) {
		try {
			const data = await statsService.getMonthlyCalendar(req.user!.userId, {
				year: Number(req.query.year),
				month: Number(req.query.month),
			});
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Monthly calendar retrieved successfully",
				data,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve monthly calendar");
		}
	},
};
