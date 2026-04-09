import { EmotionType, RecommendationMode, Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AudioFeatures {
	valence: number;
	energy: number;
	acousticness: number;
	danceability: number;
	tempo_norm: number;
}

type MoodKey =
	| "HAPPY"
	| "EXCITED"
	| "CALM"
	| "CONTENT"
	| "ANGRY"
	| "DISTRESSED"
	| "SAD"
	| "NEUTRAL";

type TrackWithArtists = Prisma.TrackGetPayload<{
	include: {
		artists: { include: { artist: { select: { name: true } } } };
	};
}>;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * 5D mood centroids synthesized from Russell's Circumplex Model +
 * empirical data from spotify-tracks.csv (N=114,000).
 * Source: docs/Music Recommendation System - Report.md, Section 4.3
 */
const MOOD_CENTROIDS: Record<MoodKey, AudioFeatures> = {
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
const WEIGHTS: AudioFeatures = {
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
const EMOTION_TO_MOOD: Partial<Record<EmotionType, MoodKey>> = {
	[EmotionType.Enjoyment]: "HAPPY",
	[EmotionType.Sadness]: "SAD",
	[EmotionType.Anger]: "ANGRY",
	[EmotionType.Fear]: "DISTRESSED",
	[EmotionType.Disgust]: "ANGRY",
	[EmotionType.Other]: "NEUTRAL",
	// EmotionType.Surprise resolved at runtime based on intensity
};

const TOTAL_TRACKS = 20;

// ── Math Helpers ──────────────────────────────────────────────────────────────

function clip(val: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, val));
}

function normalizeTempo(tempo: number): number {
	return clip((tempo - 60) / 140, 0, 1);
}

function weightedDistance(a: AudioFeatures, b: AudioFeatures): number {
	let sum = 0;
	for (const key of Object.keys(WEIGHTS) as (keyof AudioFeatures)[]) {
		const diff = a[key] - b[key];
		sum += WEIGHTS[key] * diff * diff;
	}
	return Math.sqrt(sum);
}

function interpolateCentroids(
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
function applyJitter(centroid: AudioFeatures, sigma = 0.05): AudioFeatures {
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

function emotionToMood(emotion: EmotionType, intensity: number): MoodKey {
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
function resolveCentroid(analysis: {
	primaryEmotion: EmotionType;
	confidence: number | null;
	intensity: number;
	emotionDistribution: unknown;
}): AudioFeatures {
	const confidence = analysis.confidence ?? 0;

	if (confidence >= 0.5) {
		const moodKey = emotionToMood(analysis.primaryEmotion, analysis.intensity);
		return MOOD_CENTROIDS[moodKey];
	}

	const distribution = analysis.emotionDistribution as Record<
		string,
		number
	> | null;

	if (!distribution || Object.keys(distribution).length === 0) {
		const moodKey = emotionToMood(analysis.primaryEmotion, analysis.intensity);
		return MOOD_CENTROIDS[moodKey];
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

	return blended;
}

// ── Track Fetching ────────────────────────────────────────────────────────────

async function fetchCandidateTracks(): Promise<TrackWithArtists[]> {
	return prisma.track.findMany({
		where: {
			durationMs: { gte: 120000, lte: 420000 },
			valence: { not: null },
			energy: { not: null },
			acousticness: { not: null },
			danceability: { not: null },
			tempo: { not: null },
		},
		include: {
			artists: {
				include: { artist: { select: { name: true } } },
			},
		},
	});
}

// ── Scoring & Selection ───────────────────────────────────────────────────────

function trackToFeatures(track: TrackWithArtists): AudioFeatures {
	return {
		valence: track.valence!,
		energy: track.energy!,
		acousticness: track.acousticness!,
		danceability: track.danceability!,
		tempo_norm: normalizeTempo(track.tempo!),
	};
}

function scoreTrack(track: TrackWithArtists, centroid: AudioFeatures): number {
	const distance = weightedDistance(trackToFeatures(track), centroid);
	const popularityBonus =
		track.popularity != null ? 1 - (track.popularity / 100) * 0.05 : 1;
	return distance * popularityBonus;
}

/**
 * Greedily picks up to `n` tracks from `pool` by ascending score.
 * Enforces max 2 picks per artist via shared `artistCounts` map.
 * Returns picked tracks and the remaining pool (for next stage).
 */
function selectTopN(
	pool: TrackWithArtists[],
	centroid: AudioFeatures,
	n: number,
	artistCounts: Map<string, number>,
): { picked: TrackWithArtists[]; remaining: TrackWithArtists[] } {
	const scored = pool
		.map((t) => ({ track: t, score: scoreTrack(t, centroid) }))
		.sort((a, b) => a.score - b.score);

	const picked: TrackWithArtists[] = [];
	const pickedIds = new Set<string>();

	for (const { track } of scored) {
		if (picked.length >= n) break;

		const artistIds = track.artists.map((ta) => ta.artistId);
		const canPick = artistIds.every(
			(aid) => (artistCounts.get(aid) ?? 0) < 2,
		);

		if (canPick) {
			picked.push(track);
			pickedIds.add(track.id);
			for (const aid of artistIds) {
				artistCounts.set(aid, (artistCounts.get(aid) ?? 0) + 1);
			}
		}
	}

	const remaining = pool.filter((t) => !pickedIds.has(t.id));
	return { picked, remaining };
}

// ── Mirror Mode ───────────────────────────────────────────────────────────────

function runMirrorMode(
	tracks: TrackWithArtists[],
	centroid: AudioFeatures,
	withJitter: boolean,
): TrackWithArtists[] {
	const target = withJitter ? applyJitter(centroid) : centroid;
	const artistCounts = new Map<string, number>();
	const { picked } = selectTopN(tracks, target, TOTAL_TRACKS, artistCounts);
	return picked;
}

// ── Shift Mode (ISO Principle) ────────────────────────────────────────────────

/**
 * Builds a 3-stage gradient playlist from current emotion toward CALM.
 * Stage sizes: 7 + 7 + 6 = 20.
 * No track appears twice — each stage selects from the remaining pool.
 */
function runShiftMode(
	tracks: TrackWithArtists[],
	centroid: AudioFeatures,
	sentimentScore: number,
	withJitter: boolean,
): TrackWithArtists[] {
	const calmCentroid = MOOD_CENTROIDS["CALM"];
	const absSentiment = Math.abs(sentimentScore);
	const shiftBudget = clip((absSentiment - 0.2) / 0.8, 0, 1);
	const alphaMax = 0.6 + 0.3 * (1.0 - shiftBudget);

	const stages: Array<{ alpha: number; count: number }> = [
		{ alpha: 0.2, count: 7 },
		{ alpha: alphaMax / 2, count: 7 },
		{ alpha: alphaMax, count: 6 },
	];

	const artistCounts = new Map<string, number>();
	const allPicked: TrackWithArtists[] = [];
	let pool = tracks;

	for (const stage of stages) {
		const stageCentroid = interpolateCentroids(
			centroid,
			calmCentroid,
			stage.alpha,
		);
		const effectiveCentroid = withJitter
			? applyJitter(stageCentroid)
			: stageCentroid;

		const { picked, remaining } = selectTopN(
			pool,
			effectiveCentroid,
			stage.count,
			artistCounts,
		);

		allPicked.push(...picked);
		pool = remaining;
	}

	return allPicked;
}

// ── Persistence ───────────────────────────────────────────────────────────────

async function persistRecommendation(
	userId: string,
	entryId: string,
	mode: RecommendationMode,
	orderedTracks: TrackWithArtists[],
): Promise<string> {
	return prisma.$transaction(async (tx) => {
		const rec = await tx.musicRecommendation.upsert({
			where: { entryId_mode: { entryId, mode } },
			create: { entryId, userId, mode, generatedAt: new Date() },
			update: { generatedAt: new Date() },
		});

		await tx.recommendationTrack.deleteMany({
			where: { recommendationId: rec.id },
		});

		await tx.recommendationTrack.createMany({
			data: orderedTracks.map((track, index) => ({
				recommendationId: rec.id,
				trackId: track.id,
				order: index + 1,
			})),
		});

		return rec.id;
	});
}

async function fetchFormattedRecommendation(recommendationId: string) {
	const rec = await prisma.musicRecommendation.findUniqueOrThrow({
		where: { id: recommendationId },
		include: {
			tracks: {
				orderBy: { order: "asc" },
				include: {
					track: {
						include: {
							artists: {
								include: { artist: { select: { name: true } } },
							},
						},
					},
				},
			},
		},
	});

	return {
		id: rec.id,
		entryId: rec.entryId,
		mode: rec.mode,
		generatedAt: rec.generatedAt,
		tracks: rec.tracks.map((rt) => ({
			order: rt.order,
			track: {
				id: rt.track.id,
				trackName: rt.track.trackName,
				albumName: rt.track.albumName,
				popularity: rt.track.popularity,
				durationMs: rt.track.durationMs,
				valence: rt.track.valence,
				energy: rt.track.energy,
				danceability: rt.track.danceability,
				acousticness: rt.track.acousticness,
				tempo: rt.track.tempo,
				artists: rt.track.artists.map((ta) => ({ name: ta.artist.name })),
			},
		})),
	};
}

// ── Core Generation ───────────────────────────────────────────────────────────

type EmotionAnalysisData = NonNullable<
	Prisma.MoodEntryGetPayload<{
		include: { emotionAnalysis: true };
	}>["emotionAnalysis"]
>;

async function generateAndPersist(
	userId: string,
	entryId: string,
	mode: RecommendationMode,
	analysis: EmotionAnalysisData,
	withJitter: boolean,
): Promise<string> {
	const candidates = await fetchCandidateTracks();

	if (candidates.length === 0) {
		throw new AppError("No eligible tracks available for recommendation", 503);
	}

	const centroid = resolveCentroid({
		primaryEmotion: analysis.primaryEmotion,
		confidence: analysis.confidence,
		intensity: analysis.intensity,
		emotionDistribution: analysis.emotionDistribution,
	});

	let orderedTracks: TrackWithArtists[];

	if (mode === RecommendationMode.MIRROR) {
		orderedTracks = runMirrorMode(candidates, centroid, withJitter);
	} else {
		orderedTracks = runShiftMode(
			candidates,
			centroid,
			analysis.sentimentScore,
			withJitter,
		);
	}

	return persistRecommendation(userId, entryId, mode, orderedTracks);
}

// ── Entry Validation Helper ───────────────────────────────────────────────────

async function validateEntryForRecommendation(userId: string, entryId: string) {
	const entry = await prisma.moodEntry.findUnique({
		where: { id: entryId },
		include: { emotionAnalysis: true },
	});

	if (!entry) throw new AppError("Entry not found", 404);
	if (entry.userId !== userId) throw new AppError("Access denied", 403);
	if (entry.analysisStatus !== "COMPLETED") {
		throw new AppError(
			"Emotion analysis is not completed for this entry",
			409,
		);
	}
	if (!entry.emotionAnalysis) {
		throw new AppError("Emotion analysis data not found", 404);
	}

	const mode: RecommendationMode =
		entry.emotionAnalysis.sentimentScore < -0.2
			? RecommendationMode.SHIFT
			: RecommendationMode.MIRROR;

	return { entry, analysis: entry.emotionAnalysis, mode };
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getOrCreateRecommendation(userId: string, entryId: string) {
	const { analysis, mode } = await validateEntryForRecommendation(
		userId,
		entryId,
	);

	const existing = await prisma.musicRecommendation.findUnique({
		where: { entryId_mode: { entryId, mode } },
	});

	if (existing) {
		return fetchFormattedRecommendation(existing.id);
	}

	const recommendationId = await generateAndPersist(
		userId,
		entryId,
		mode,
		analysis,
		false,
	);

	return fetchFormattedRecommendation(recommendationId);
}

async function refreshRecommendation(userId: string, entryId: string) {
	const { analysis, mode } = await validateEntryForRecommendation(
		userId,
		entryId,
	);

	const recommendationId = await generateAndPersist(
		userId,
		entryId,
		mode,
		analysis,
		true,
	);

	return fetchFormattedRecommendation(recommendationId);
}

async function getRecentRecommendation(userId: string, limit: number) {
	const rec = await prisma.musicRecommendation.findFirst({
		where: { userId },
		orderBy: { generatedAt: "desc" },
		include: {
			tracks: {
				orderBy: { order: "asc" },
				take: limit,
				include: {
					track: {
						include: {
							artists: {
								include: { artist: { select: { name: true } } },
							},
						},
					},
				},
			},
		},
	});

	if (!rec) return { recommendation: null };

	return {
		recommendation: {
			id: rec.id,
			entryId: rec.entryId,
			mode: rec.mode,
			generatedAt: rec.generatedAt,
			tracks: rec.tracks.map((rt) => ({
				order: rt.order,
				track: {
					id: rt.track.id,
					trackName: rt.track.trackName,
					albumName: rt.track.albumName,
					durationMs: rt.track.durationMs,
					artists: rt.track.artists.map((ta) => ({ name: ta.artist.name })),
				},
			})),
		},
	};
}

export const musicService = {
	getOrCreateRecommendation,
	refreshRecommendation,
	getRecentRecommendation,
};
