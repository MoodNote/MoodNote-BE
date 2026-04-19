import { Request, Response } from "express";
import { analysisService } from "../services/analysis.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const analysisController = {
  /**
   * POST /api/entries/:id/analyze
   * Manually trigger re-analysis on a PENDING or FAILED entry.
   * Returns 202 Accepted — analysis runs asynchronously.
   */
  async triggerAnalysis(req: Request, res: Response) {
    try {
      await analysisService.triggerAnalysis(req.user!.userId, req.params.id);

      res.status(HttpStatus.ACCEPTED).json({
        success: true,
        message: "Đã bắt đầu phân tích cảm xúc",
      });
    } catch (error) {
      handleError(error, res, "Không thể kích hoạt phân tích");
    }
  },
};
