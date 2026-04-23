import { MusicStatus } from "@prisma/client";
import prisma from "../config/database";
import { analysisService } from "./analysis.service";
import { musicService } from "./music.service";
import { statsService } from "./stats.service";

class PipelineService {
  /**
   * Triggers emotion analysis after an entry is created or its content updated.
   * Fire-and-forget — does not block the caller.
   */
  onEntryNeedsAnalysis(entryId: string): void {
    analysisService.runAnalysis(entryId).catch((err) =>
      console.error(
        `[Pipeline] Analysis failed for entry ${entryId}:`,
        err instanceof Error ? err.message : String(err),
      ),
    );
  }

  /**
   * Triggers music recommendation generation after analysis completes.
   * Fire-and-forget — does not block the caller.
   * Marks musicStatus = FAILED on the entry if generation throws.
   */
  onAnalysisCompleted(userId: string, entryId: string): void {
    statsService.recomputeAndSaveStreaks(userId).catch((err) =>
      console.warn(
        "[Pipeline] Streak update failed:",
        err instanceof Error ? err.message : String(err),
      ),
    );
    musicService.autoGenerateRecommendation(userId, entryId).catch((err) => {
      console.error(
        `[Pipeline] Music generation failed for entry ${entryId}:`,
        err instanceof Error ? err.message : String(err),
      );
      prisma.moodEntry
        .update({ where: { id: entryId }, data: { musicStatus: MusicStatus.FAILED } })
        .catch(() => {}); // Swallow if entry was deleted
    });
  }
}

export const pipelineService = new PipelineService();
