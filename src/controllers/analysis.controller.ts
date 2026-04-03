import { Request, Response } from "express";
import { analysisService } from "../services/analysis.service";
import { AppError } from "../utils/app-error.util";

export const analysisController = {
  /**
   * POST /api/entries/:id/analyze
   * Manually trigger re-analysis on a PENDING or FAILED entry.
   * Returns 202 Accepted — analysis runs asynchronously.
   */
  async triggerAnalysis(req: Request, res: Response) {
    try {
      await analysisService.triggerAnalysis(req.user!.userId, req.params.id);

      res.status(202).json({
        success: true,
        message: "Đã bắt đầu phân tích cảm xúc",
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res
          .status(error.statusCode)
          .json({ success: false, message: error.message });
      }
      res.status(500).json({
        success: false,
        message: "Không thể kích hoạt phân tích",
      });
    }
  },
};
