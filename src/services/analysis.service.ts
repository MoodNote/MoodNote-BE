import { EmotionType } from "@prisma/client";
import prisma from "../config/database";
import { decrypt } from "../utils/encryption.util";
import { AppError } from "../utils/app-error.util";
import { aiService } from "./ai.service";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// ── Types (mirrors entry.service.ts internals) ────────────────────────────────

interface DeltaOp {
  insert: string | Record<string, unknown>;
}

interface EntryPayload {
  title: string | null;
  content: { ops: DeltaOp[] };
}

// ── Emotion Mapping ───────────────────────────────────────────────────────────

const AI_EMOTION_MAP: Record<string, EmotionType> = {
  Enjoyment: EmotionType.Enjoyment,
  Sadness: EmotionType.Sadness,
  Anger: EmotionType.Anger,
  Fear: EmotionType.Fear,
  Disgust: EmotionType.Disgust,
  Surprise: EmotionType.Surprise,
  Other: EmotionType.Other,
};

function mapEmotion(aiEmotion: string): EmotionType {
  return AI_EMOTION_MAP[aiEmotion] ?? EmotionType.Other;
}

// ── Plain Text Extraction ─────────────────────────────────────────────────────

function extractPlainTextFromEntry(
  encryptedContent: string,
  iv: string,
): string {
  const decrypted = decrypt(encryptedContent, iv, ENCRYPTION_KEY);
  const payload: EntryPayload = JSON.parse(decrypted);

  const contentText = payload.content.ops
    .filter((op) => typeof op.insert === "string")
    .map((op) => op.insert as string)
    .join("")
    .trim();

  // Include title for richer analysis context
  const titleText = payload.title ? `${payload.title}\n` : "";
  return `${titleText}${contentText}`;
}

// ── Core Analysis Worker ──────────────────────────────────────────────────────

/**
 * Runs AI analysis on a single MoodEntry and persists the result.
 * Updates analysisStatus: PENDING/FAILED → PROCESSING → COMPLETED/FAILED.
 * Never throws — designed for fire-and-forget use.
 */
async function runAnalysis(entryId: string): Promise<void> {
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
    const plainText = extractPlainTextFromEntry(
      entry.encryptedContent,
      entry.contentIv,
    );

    // 4. Call AI service
    const aiResult = await aiService.analyzeDiary(plainText);

    if (!aiResult) {
      await prisma.moodEntry.update({
        where: { id: entryId },
        data: { analysisStatus: "FAILED" },
      });
      return;
    }

    // 5. Map and persist result atomically
    const primaryEmotion = mapEmotion(aiResult.overall_emotion);

    await prisma.$transaction([
      prisma.emotionAnalysis.upsert({
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
      }),
      prisma.moodEntry.update({
        where: { id: entryId },
        data: { analysisStatus: "COMPLETED" },
      }),
    ]);
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
async function triggerAnalysis(
  userId: string,
  entryId: string,
): Promise<void> {
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
  runAnalysis(entryId).catch((err) =>
    console.error("[Analysis] Unhandled error in runAnalysis:", err),
  );
}

// ── Admin Functions ───────────────────────────────────────────────────────────

/**
 * Admin: force re-analyze any entry, including COMPLETED ones.
 * Resets status to PENDING before firing analysis.
 * Throws AppError for not found or currently PROCESSING.
 */
async function forceReanalyze(entryId: string): Promise<void> {
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

  runAnalysis(entryId).catch((err) =>
    console.error("[Analysis] Admin force re-analyze error:", err),
  );
}

/**
 * Admin: queue all FAILED entries for re-analysis.
 * Returns the count of entries queued.
 */
async function retryFailed(): Promise<number> {
  const failedEntries = await prisma.moodEntry.findMany({
    where: { analysisStatus: "FAILED" },
    select: { id: true },
  });

  for (const { id } of failedEntries) {
    runAnalysis(id).catch((err) =>
      console.error(`[Analysis] Retry failed error for entry ${id}:`, err),
    );
  }

  return failedEntries.length;
}

/**
 * Admin: get analysis status counts across all entries.
 */
async function getStats(): Promise<{
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

export const analysisService = {
  runAnalysis,
  triggerAnalysis,
  forceReanalyze,
  retryFailed,
  getStats,
};
