import { aiService, AiDiaryAnalysis } from "./ai.service";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";

export const adminAiService = {
	async checkHealth(): Promise<{ status: string; latencyMs: number }> {
		const start = Date.now();
		const healthy = await aiService.checkHealth();
		return {
			status: healthy ? "ok" : "down",
			latencyMs: Date.now() - start,
		};
	},

	async testAnalyze(
		text: string,
	): Promise<{ result: AiDiaryAnalysis; latencyMs: number }> {
		const start = Date.now();
		const result = await aiService.analyzeDiary(text);
		const latencyMs = Date.now() - start;
		if (!result) {
			throw new AppError(
				"AI service unavailable or returned an error",
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		return { result, latencyMs };
	},
};
