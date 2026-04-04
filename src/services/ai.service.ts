import { aiConfig } from "../config/ai.config";

// ── AI Response Types ─────────────────────────────────────────────────────────

export interface AiDiaryAnalysis {
  overall_emotion: string; // "Enjoyment" | "Sadness" | "Anger" | "Fear" | "Disgust" | "Surprise" | "Other"
  overall_confidence: number; // 0.0–1.0
  overall_sentiment: number; // -1.0 to +1.0
  overall_intensity: number; // 0–100
  emotion_distribution: Record<string, number>;
  keywords: string[];
  sentence_count: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calls POST /predict/diary on the AI microservice.
 * Returns null on any failure (timeout, service down, bad response).
 * Never throws — callers do not need try/catch.
 */
async function analyzeDiary(text: string): Promise<AiDiaryAnalysis | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

  try {
    const response = await fetch(`${aiConfig.serviceUrl}/predict/diary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[AI Service] HTTP ${response.status} from /predict/diary`);
      return null;
    }

    const body = (await response.json()) as {
      success: boolean;
      data: AiDiaryAnalysis;
    };
    return body.data ?? null;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(
        `[AI Service] Request timed out after ${aiConfig.timeoutMs}ms`,
      );
    } else {
      console.error(
        "[AI Service] Request failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls GET /health on the AI microservice.
 * Returns true if the service is reachable and healthy.
 */
async function checkHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${aiConfig.serviceUrl}/health`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const aiService = { analyzeDiary, checkHealth };
