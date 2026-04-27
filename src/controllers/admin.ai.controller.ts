import { Request, Response } from "express";
import { adminAiService } from "../services/admin.ai.service";
import { analysisService } from "../services/analysis.service";
import { HttpStatus } from "../utils/http-status.util";

export const adminAiController = {
	async checkHealth(_req: Request, res: Response) {
		const data = await adminAiService.checkHealth();
		res.status(HttpStatus.OK).json({
			success: true,
			message:
				data.status === "ok"
					? "AI service is reachable"
					: "AI service is unreachable",
			data,
		});
	},

	async testAnalyze(req: Request, res: Response) {
		const { text } = req.body as { text: string };
		const data = await adminAiService.testAnalyze(text);
		res.status(HttpStatus.OK).json({
			success: true,
			message: "Analysis complete",
			data,
		});
	},

	async forceAnalyzeEntry(req: Request, res: Response) {
		await analysisService.forceReanalyze(req.params.id);
		res.status(HttpStatus.ACCEPTED).json({
			success: true,
			message: "Re-analysis started",
		});
	},

	async retryFailed(_req: Request, res: Response) {
		const queued = await analysisService.retryFailed();
		res.status(HttpStatus.ACCEPTED).json({
			success: true,
			message: `Queued ${queued} failed ${queued === 1 ? "entry" : "entries"} for re-analysis`,
			data: { queued },
		});
	},

	async getStats(_req: Request, res: Response) {
		const stats = await analysisService.getStats();
		res.status(HttpStatus.OK).json({
			success: true,
			message: "Analysis statistics",
			data: stats,
		});
	},
};
