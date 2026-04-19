import { Request, Response } from "express";
import { aiService } from "../services/ai.service";
import { analysisService } from "../services/analysis.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const adminAiController = {
  /**
   * GET /api/admin/ai/health
   * Check AI microservice reachability and latency.
   */
  async checkHealth(_req: Request, res: Response) {
    const start = Date.now();
    const healthy = await aiService.checkHealth();
    const latencyMs = Date.now() - start;

    res.status(HttpStatus.OK).json({
      success: true,
      message: healthy ? "AI service is reachable" : "AI service is unreachable",
      data: {
        status: healthy ? "ok" : "down",
        latencyMs,
      },
    });
  },

  /**
   * POST /api/admin/ai/analyze
   * Body: { text: string }
   * Send raw text to AI service and return result — no DB side effects.
   */
  async testAnalyze(req: Request, res: Response) {
    const { text } = req.body as { text: string };

    const start = Date.now();
    const result = await aiService.analyzeDiary(text);
    const latencyMs = Date.now() - start;

    if (!result) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        success: false,
        message: "AI service unavailable or returned an error",
      });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Analysis complete",
      data: { result, latencyMs },
    });
  },

  /**
   * POST /api/admin/ai/entries/:id/analyze
   * Force re-analyze any entry (bypasses ownership and COMPLETED check).
   * Returns 202 — analysis runs asynchronously.
   */
  async forceAnalyzeEntry(req: Request, res: Response) {
    try {
      await analysisService.forceReanalyze(req.params.id);
      res.status(HttpStatus.ACCEPTED).json({
        success: true,
        message: "Re-analysis started",
      });
    } catch (error) {
      handleError(error, res, "Internal server error");
    }
  },

  /**
   * POST /api/admin/ai/retry-failed
   * Queue all FAILED entries for re-analysis.
   * Returns 202 with the count of queued entries.
   */
  async retryFailed(_req: Request, res: Response) {
    const queued = await analysisService.retryFailed();
    res.status(HttpStatus.ACCEPTED).json({
      success: true,
      message: `Queued ${queued} failed ${queued === 1 ? "entry" : "entries"} for re-analysis`,
      data: { queued },
    });
  },

  /**
   * GET /api/admin/ai/stats
   * Return analysis status counts across all entries.
   */
  async getStats(_req: Request, res: Response) {
    const stats = await analysisService.getStats();
    res.status(HttpStatus.OK).json({
      success: true,
      message: "Analysis statistics",
      data: stats,
    });
  },
};
