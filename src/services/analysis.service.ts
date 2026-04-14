import { EmotionType, MusicStatus } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";
import { decryptAndExtractText } from "../utils/entry.util";
import { aiService, type AiDiaryAnalysis } from "./ai.service";
import { pipelineService } from "./pipeline.service";

class AnalysisService {
  // ── Emotion Mapping ───────────────────────────────────────────────────────────

  private readonly AI_EMOTION_MAP: Record<string, EmotionType> = {
    Enjoyment: EmotionType.Enjoyment,
    Sadness: EmotionType.Sadness,
    Anger: EmotionType.Anger,
    Fear: EmotionType.Fear,
    Disgust: EmotionType.Disgust,
    Surprise: EmotionType.Surprise,
    Other: EmotionType.Other,
  };

  private mapEmotion(aiEmotion: string): EmotionType {
    return this.AI_EMOTION_MAP[aiEmotion] ?? EmotionType.Other;
  }

  // ── AI Retry Helper ───────────────────────────────────────────────────────────

  /**
   * Calls the AI service with up to `maxRetries` additional attempts.
   * Waits 2s then 4s between attempts before giving up.
   * Returns null only after all retries are exhausted.
   */
  private async callAIWithRetry(
    text: string,
    maxRetries = 2,
  ): Promise<AiDiaryAnalysis | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await aiService.analyzeDiary(text);
      if (result !== null) return result;

      if (attempt < maxRetries) {
        const delayMs = 2000 * (attempt + 1); // 2s, 4s
        console.warn(
          `[Analysis] AI attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return null;
  }

  // ── Core Analysis Worker ──────────────────────────────────────────────────────

  /**
   * Runs AI analysis on a single MoodEntry and persists the result.
   * Updates analysisStatus: PENDING/FAILED → PROCESSING → COMPLETED/FAILED.
   * Never throws — designed for fire-and-forget use.
   */
  async runAnalysis(entryId: string): Promise<void> {
    // 1. Fetch entry — skip if not in an eligible state
    const entry = await prisma.moodEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      console.error(`[Analysis] Entry ${entryId} not found`);
      return;
    }

    if (
      entry.analysisStatus !== "PENDING" &&
      entry.analysisStatus !== "FAILED"
    ) {
      return;
    }

    // 2. Set status to PROCESSING
    await prisma.moodEntry.update({
      where: { id: entryId },
      data: { analysisStatus: "PROCESSING" },
    });

    try {
      // 3. Decrypt and extract plain text
      const plainText = decryptAndExtractText(entry.encryptedContent, entry.contentIv);

      // 4. Call AI service (with retry)
      const aiResult = await this.callAIWithRetry(plainText);

      if (!aiResult) {
        await prisma.moodEntry.update({
          where: { id: entryId },
          data: { analysisStatus: "FAILED" },
        });
        return;
      }

      // 5. Map and persist result atomically.
      //    Guard: abort if content was updated while we were calling the AI service.
      //    updateEntry resets analysisStatus → PENDING when content changes,
      //    so if status is no longer PROCESSING our result is for stale content.
      const primaryEmotion = this.mapEmotion(aiResult.overall_emotion);

      const committed = await prisma.$transaction(async (tx) => {
        const current = await tx.moodEntry.findUnique({
          where: { id: entryId },
          select: { analysisStatus: true },
        });

        if (current?.analysisStatus !== "PROCESSING") {
          return false; // Content was updated — let the new runAnalysis handle it
        }

        await tx.emotionAnalysis.upsert({
          where: { entryId },
          create: {
            entryId,
            primaryEmotion,
            sentimentScore: aiResult.overall_sentiment,
            intensity: aiResult.overall_intensity,
            confidence: aiResult.overall_confidence,
            emotionDistribution: aiResult.emotion_distribution,
            keywords: aiResult.keywords,
            modelVersion: "phobert-v1",
          },
          update: {
            primaryEmotion,
            sentimentScore: aiResult.overall_sentiment,
            intensity: aiResult.overall_intensity,
            confidence: aiResult.overall_confidence,
            emotionDistribution: aiResult.emotion_distribution,
            keywords: aiResult.keywords,
            analyzedAt: new Date(),
          },
        });

        await tx.moodEntry.update({
          where: { id: entryId },
          data: {
            analysisStatus: "COMPLETED",
            musicStatus: MusicStatus.PENDING, // Reset so pipeline starts fresh generation
          },
        });

        // Clear cached music recommendations so they regenerate from the new analysis
        await tx.musicRecommendation.deleteMany({ where: { entryId } });

        return true;
      });

      if (committed) {
        // Trigger music recommendation generation — fire-and-forget via pipeline
        pipelineService.onAnalysisCompleted(entry.userId, entryId);
      }
    } catch (err: unknown) {
      console.error(
        `[Analysis] Failed for entry ${entryId}:`,
        err instanceof Error ? err.message : String(err),
      );
      await prisma.moodEntry
        .update({
          where: { id: entryId },
          data: { analysisStatus: "FAILED" },
        })
        .catch(() => {});
    }
  }

  // ── Public Trigger (for controller) ──────────────────────────────────────────

  /**
   * Validates ownership and status, then kicks off runAnalysis fire-and-forget.
   * Throws AppError so the controller can map to the correct HTTP status.
   */
  async triggerAnalysis(userId: string, entryId: string): Promise<void> {
    const entry = await prisma.moodEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) throw new AppError("Entry not found", 404);
    if (entry.userId !== userId) throw new AppError("Access denied", 403);
    if (entry.analysisStatus === "PROCESSING") {
      throw new AppError("Analysis already in progress", 409);
    }
    if (entry.analysisStatus === "COMPLETED") {
      throw new AppError("Entry already analyzed", 409);
    }

    // Fire-and-forget
    this.runAnalysis(entryId).catch((err) =>
      console.error("[Analysis] Unhandled error in runAnalysis:", err),
    );
  }

  // ── Admin Functions ───────────────────────────────────────────────────────────

  /**
   * Admin: force re-analyze any entry, including COMPLETED ones.
   * Resets status to PENDING before firing analysis.
   * Throws AppError for not found or currently PROCESSING.
   */
  async forceReanalyze(entryId: string): Promise<void> {
    const entry = await prisma.moodEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new AppError("Entry not found", 404);
    if (entry.analysisStatus === "PROCESSING") {
      throw new AppError("Analysis already in progress", 409);
    }

    // Reset COMPLETED back to PENDING so runAnalysis will pick it up
    if (entry.analysisStatus !== "PENDING" && entry.analysisStatus !== "FAILED") {
      await prisma.moodEntry.update({
        where: { id: entryId },
        data: { analysisStatus: "PENDING" },
      });
    }

    this.runAnalysis(entryId).catch((err) =>
      console.error("[Analysis] Admin force re-analyze error:", err),
    );
  }

  /**
   * Admin: queue all FAILED entries for re-analysis.
   * Returns the count of entries queued.
   */
  async retryFailed(): Promise<number> {
    const failedEntries = await prisma.moodEntry.findMany({
      where: { analysisStatus: "FAILED" },
      select: { id: true },
    });

    // Process sequentially — avoids DB connection pool saturation when retrying many entries at once
    (async () => {
      for (const { id } of failedEntries) {
        await this.runAnalysis(id).catch((err) =>
          console.error(`[Analysis] Retry failed error for entry ${id}:`, err),
        );
      }
    })();

    return failedEntries.length;
  }

  /**
   * Admin: get analysis status counts across all entries.
   */
  async getStats(): Promise<{
    byStatus: Record<string, number>;
    total: number;
  }> {
    const grouped = await prisma.moodEntry.groupBy({
      by: ["analysisStatus"],
      _count: { id: true },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of grouped) {
      byStatus[row.analysisStatus] = row._count.id;
      total += row._count.id;
    }

    return { byStatus, total };
  }

  // ── Startup Recovery ──────────────────────────────────────────────────────────

  /**
   * Called once on server start.
   * Resets any entries stuck in PROCESSING (from a previous crash) back to PENDING,
   * then queues all PENDING entries for analysis.
   */
  async recoverOnStartup(): Promise<void> {
    const { count } = await prisma.moodEntry.updateMany({
      where: { analysisStatus: "PROCESSING" },
      data: { analysisStatus: "PENDING" },
    });

    if (count > 0) {
      console.log(`[Startup] Reset ${count} stuck PROCESSING entries to PENDING`);
    }

    const pending = await prisma.moodEntry.findMany({
      where: { analysisStatus: "PENDING" },
      select: { id: true },
    });

    for (const { id } of pending) {
      this.runAnalysis(id).catch((err) =>
        console.error(`[Startup] Failed to queue entry ${id} for analysis:`, err),
      );
    }

    if (pending.length > 0) {
      console.log(`[Startup] Queued ${pending.length} pending entries for analysis`);
    }
  }
}

export const analysisService = new AnalysisService();
