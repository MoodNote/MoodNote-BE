import { MusicStatus } from "@prisma/client";
import prisma from "../config/database";
import { analysisService } from "./analysis.service";
import { musicService } from "./music.service";

/**
 * Triggers emotion analysis after an entry is created or its content updated.
 * Fire-and-forget — does not block the caller.
 */
export function onEntryNeedsAnalysis(entryId: string): void {
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
export function onAnalysisCompleted(userId: string, entryId: string): void {
  musicService.autoGenerateRecommendation(userId, entryId).catch(async (err) => {
    console.error(
      `[Pipeline] Music generation failed for entry ${entryId}:`,
      err instanceof Error ? err.message : String(err),
    );
    await prisma.moodEntry
      .update({ where: { id: entryId }, data: { musicStatus: MusicStatus.FAILED } })
      .catch(() => {}); // Swallow if entry was deleted
  });
}
