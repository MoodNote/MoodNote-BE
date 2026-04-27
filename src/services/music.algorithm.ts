import { EmotionType, Prisma } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AudioFeatures {
	valence: number;
	energy: number;
	acousticness: number;
	danceability: number;
	tempo_norm: number;
}

export type MoodKey =
	| "HAPPY"
	| "EXCITED"
	| "CALM"
	| "CONTENT"
	| "ANGRY"
	| "DISTRESSED"
	| "SAD"
	| "NEUTRAL";

export type TrackWithArtists = Prisma.TrackGetPayload<{
	include: {
		artists: { include: { artist: { select: { name: true } } } };
	};
}>;

export interface TrackDiagnostic {
	trackId: string;
	score: number;
	stage?: 1 | 2 | 3;
}

export interface ShiftParams {
	shiftBudget: number;
	alphaMax: number;
	stageAlphas: [number, number, number];
	stageCentroids: [AudioFeatures, AudioFeatures, AudioFeatures];
}

export interface AlgorithmDiagnostics {
	moodKey: MoodKey | "BLENDED";
	isBlended: boolean;
	resolvedCentroid: AudioFeatures;
	trackDiagnostics: TrackDiagnostic[];
	shiftParams?: ShiftParams;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * 5D mood centroids synthesized from Russell's Circumplex Model +
 * empirical data from spotify-tracks.csv (N=114,000).
 * Source: docs/Music Recommendation System - Report.md, Section 4.3
 */
export const MOOD_CENTROIDS: Record<MoodKey, AudioFeatures> = {
	HAPPY: {
		valence: 0.95,
		energy: 0.575,
		danceability: 0.66,
		tempo_norm: 0.482,
		acousticness: 0.16,
	},
	EXCITED: {
		valence: 0.85,
		energy: 0.86,
		danceability: 0.70,
		tempo_norm: 0.482,
		acousticness: 0.12,
	},
	CALM: {
		valence: 0.85,
		energy: 0.175,
		danceability: 0.639,
		tempo_norm: 0.411,
		acousticness: 0.61,
	},
	CONTENT: {
		valence: 0.90,
		energy: 0.225,
		danceability: 0.639,
		tempo_norm: 0.411,
		acousticness: 0.61,
	},
	ANGRY: {
		valence: 0.30,
		energy: 0.90,
		danceability: 0.527,
		tempo_norm: 0.418,
		acousticness: 0.141,
	},
	DISTRESSED: {
		valence: 0.15,
		energy: 0.775,
		danceability: 0.623,
		tempo_norm: 0.418,
		acousticness: 0.192,
	},
	SAD: {
		valence: 0.10,
		energy: 0.30,
		danceability: 0.467,
		tempo_norm: 0.338,
		acousticness: 0.684,
	},
	NEUTRAL: {
		valence: 0.50,
		energy: 0.50,
		danceability: 0.622,
		tempo_norm: 0.357,
		acousticness: 0.404,
	},
};

/**
 * Feature weights derived from RFE ranking + correlation studies.
 * Source: docs/Music Recommendation System - Report.md, Section 4.2
 */
export const WEIGHTS: AudioFeatures = {
	energy: 0.27,
	valence: 0.23,
	acousticness: 0.23,
	danceability: 0.18,
	tempo_norm: 0.09,
};

/**
 * Maps UIT-VSMEC emotion classes to Russell mood centroids.
 * Surprise is handled separately (intensity-dependent).
 * Source: Section 4.4
 */
export const EMOTION_TO_MOOD: Partial<Record<EmotionType, MoodKey>> = {
	[EmotionType.Enjoyment]: "HAPPY",
	[EmotionType.Sadness]: "SAD",
	[EmotionType.Anger]: "ANGRY",
	[EmotionType.Fear]: "DISTRESSED",
	[EmotionType.Disgust]: "ANGRY",
	[EmotionType.Other]: "NEUTRAL",
	// EmotionType.Surprise resolved at runtime based on intensity
};

export const TOTAL_TRACKS = 20;

// ── Math Helpers ──────────────────────────────────────────────────────────────

export function clip(val: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, val));
}

export function normalizeTempo(tempo: number): number {
	return clip((tempo - 60) / 140, 0, 1);
}

export function weightedDistance(a: AudioFeatures, b: AudioFeatures): number {
	let sum = 0;
	for (const key of Object.keys(WEIGHTS) as (keyof AudioFeatures)[]) {
		const diff = a[key] - b[key];
		sum += WEIGHTS[key] * diff * diff;
	}
	return Math.sqrt(sum);
}

export function interpolateCentroids(
	a: AudioFeatures,
	b: AudioFeatures,
	alpha: number,
): AudioFeatures {
	const result = {} as AudioFeatures;
	for (const key of Object.keys(WEIGHTS) as (keyof AudioFeatures)[]) {
		result[key] = (1 - alpha) * a[key] + alpha * b[key];
	}
	return result;
}

/**
 * Adds Gaussian jitter N(0, sigma) to each feature, clipped to [0,1].
 * Uses Box-Muller transform.
 */
export function applyJitter(centroid: AudioFeatures, sigma = 0.05): AudioFeatures {
	const result = {} as AudioFeatures;
	for (const key of Object.keys(centroid) as (keyof AudioFeatures)[]) {
		const u1 = Math.random();
		const u2 = Math.random();
		const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
		result[key] = clip(centroid[key] + sigma * z, 0, 1);
	}
	return result;
}

// ── Centroid Resolution ───────────────────────────────────────────────────────

export function emotionToMood(emotion: EmotionType, intensity: number): MoodKey {
	if (emotion === EmotionType.Surprise) {
		return intensity >= 50 ? "EXCITED" : "CONTENT";
	}
	return EMOTION_TO_MOOD[emotion] ?? "NEUTRAL";
}

/**
 * Resolves the target AudioFeatures centroid from an EmotionAnalysis record.
 *
 * - confidence >= 0.5: direct centroid for primaryEmotion
 * - confidence < 0.5:  blended centroid weighted by emotionDistribution probs
 */
export function resolveCentroid(analysis: {
	primaryEmotion: EmotionType;
	confidence: number | null;
	intensity: number;
	emotionDistribution: unknown;
}): { centroid: AudioFeatures; moodKey: MoodKey | "BLENDED"; isBlended: boolean } {
	const confidence = analysis.confidence ?? 0;

	if (confidence >= 0.5) {
		const moodKey = emotionToMood(analysis.primaryEmotion, analysis.intensity);
		return { centroid: MOOD_CENTROIDS[moodKey], moodKey, isBlended: false };
	}

	const distribution = analysis.emotionDistribution as Record<
		string,
		number
	> | null;

	if (!distribution || Object.keys(distribution).length === 0) {
		const moodKey = emotionToMood(analysis.primaryEmotion, analysis.intensity);
		return { centroid: MOOD_CENTROIDS[moodKey], moodKey, isBlended: false };
	}

	const blended: AudioFeatures = {
		valence: 0,
		energy: 0,
		acousticness: 0,
		danceability: 0,
		tempo_norm: 0,
	};
	let totalWeight = 0;

	for (const [emotionStr, prob] of Object.entries(distribution)) {
		if (prob <= 0) continue;
		const emotion = emotionStr as EmotionType;
		const moodKey = emotionToMood(emotion, analysis.intensity);
		const centroid = MOOD_CENTROIDS[moodKey];
		if (!centroid) continue;

		for (const key of Object.keys(blended) as (keyof AudioFeatures)[]) {
			blended[key] += prob * centroid[key];
		}
		totalWeight += prob;
	}

	if (totalWeight > 0) {
		for (const key of Object.keys(blended) as (keyof AudioFeatures)[]) {
			blended[key] /= totalWeight;
		}
	}

	return { centroid: blended, moodKey: "BLENDED", isBlended: true };
}

// ── Scoring & Selection ───────────────────────────────────────────────────────

export function trackToFeatures(track: TrackWithArtists): AudioFeatures {
	return {
		valence: track.valence!,
		energy: track.energy!,
		acousticness: track.acousticness!,
		danceability: track.danceability!,
		tempo_norm: normalizeTempo(track.tempo!),
	};
}

export function scoreTrack(track: TrackWithArtists, centroid: AudioFeatures): number {
	const distance = weightedDistance(trackToFeatures(track), centroid);
	// Popular tracks get a small bonus (lower score = better fit).
	// Multiplier range: [0.95, 1.0] — popularity influences at most 5%.
	const popularityBonus =
		track.popularity != null ? 1 - (track.popularity / 100) * 0.05 : 1;
	return distance * popularityBonus;
}

/**
 * Greedily picks up to `n` tracks from `pool` by ascending score.
 * Enforces max 2 picks per artist via shared `artistCounts` map.
 * Returns picked tracks, the remaining pool (for next stage), and per-track scores.
 */
export function selectTopN(
	pool: TrackWithArtists[],
	centroid: AudioFeatures,
	n: number,
	artistCounts: Map<string, number>,
): { picked: TrackWithArtists[]; remaining: TrackWithArtists[]; scores: Map<string, number> } {
	const scored = pool
		.map((t) => ({ track: t, score: scoreTrack(t, centroid) }))
		.sort((a, b) => a.score - b.score);

	const picked: TrackWithArtists[] = [];
	const pickedIds = new Set<string>();
	const scores = new Map<string, number>();

	for (const { track, score } of scored) {
		if (picked.length >= n) break;

		const artistIds = track.artists.map((ta) => ta.artistId);
		const canPick = artistIds.every(
			(aid) => (artistCounts.get(aid) ?? 0) < 2,
		);

		if (canPick) {
			picked.push(track);
			pickedIds.add(track.id);
			scores.set(track.id, score);
			for (const aid of artistIds) {
				artistCounts.set(aid, (artistCounts.get(aid) ?? 0) + 1);
			}
		}
	}

	const remaining = pool.filter((t) => !pickedIds.has(t.id));
	return { picked, remaining, scores };
}

// ── Mirror Mode ───────────────────────────────────────────────────────────────

export function runMirrorMode(
	tracks: TrackWithArtists[],
	centroid: AudioFeatures,
	withJitter: boolean,
): { tracks: TrackWithArtists[]; trackDiagnostics: TrackDiagnostic[] } {
	const target = withJitter ? applyJitter(centroid) : centroid;
	const artistCounts = new Map<string, number>();
	const { picked, scores } = selectTopN(tracks, target, TOTAL_TRACKS, artistCounts);
	const trackDiagnostics: TrackDiagnostic[] = picked.map((t) => ({
		trackId: t.id,
		score: scores.get(t.id)!,
	}));
	return { tracks: picked, trackDiagnostics };
}

// ── Shift Mode (ISO Principle) ────────────────────────────────────────────────

/**
 * Builds a 3-stage gradient playlist from current emotion toward CALM.
 * Stage sizes: 7 + 7 + 6 = 20.
 * No track appears twice — each stage selects from the remaining pool.
 */
export function runShiftMode(
	tracks: TrackWithArtists[],
	centroid: AudioFeatures,
	sentimentScore: number,
	withJitter: boolean,
): { tracks: TrackWithArtists[]; trackDiagnostics: TrackDiagnostic[]; shiftParams: ShiftParams } {
	const calmCentroid = MOOD_CENTROIDS["CALM"];
	const absSentiment = Math.abs(sentimentScore);
	const shiftBudget = clip((absSentiment - 0.2) / 0.8, 0, 1);
	const alphaMax = 0.6 + 0.3 * (1.0 - shiftBudget);

	const stageDefinitions: Array<{ alpha: number; count: number }> = [
		{ alpha: 0.2, count: 7 },
		{ alpha: alphaMax / 2, count: 7 },
		{ alpha: alphaMax, count: 6 },
	];

	// Compute clean (pre-jitter) stage centroids for diagnostics
	const stageCentroids = stageDefinitions.map((s) =>
		interpolateCentroids(centroid, calmCentroid, s.alpha),
	) as [AudioFeatures, AudioFeatures, AudioFeatures];

	const shiftParams: ShiftParams = {
		shiftBudget,
		alphaMax,
		stageAlphas: [stageDefinitions[0].alpha, stageDefinitions[1].alpha, stageDefinitions[2].alpha],
		stageCentroids,
	};

	const artistCounts = new Map<string, number>();
	const allPicked: TrackWithArtists[] = [];
	const trackDiagnostics: TrackDiagnostic[] = [];
	let pool = tracks;

	for (let i = 0; i < stageDefinitions.length; i++) {
		const stage = stageDefinitions[i];
		const stageNum = (i + 1) as 1 | 2 | 3;
		const effectiveCentroid = withJitter
			? applyJitter(stageCentroids[i])
			: stageCentroids[i];

		const { picked, remaining, scores } = selectTopN(
			pool,
			effectiveCentroid,
			stage.count,
			artistCounts,
		);

		for (const t of picked) {
			trackDiagnostics.push({ trackId: t.id, score: scores.get(t.id)!, stage: stageNum });
		}
		allPicked.push(...picked);
		pool = remaining;
	}

	return { tracks: allPicked, trackDiagnostics, shiftParams };
}
