import { RecommendationMode, MusicStatus, Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";
import { decryptEntry } from "../utils/entry.util";
import {
	resolveCentroid,
	runMirrorMode,
	runShiftMode,
	type AlgorithmDiagnostics,
	type TrackDiagnostic,
	type TrackWithArtists,
} from "./music.algorithm";

type EmotionAnalysisData = NonNullable<
	Prisma.MoodEntryGetPayload<{
		include: { emotionAnalysis: true };
	}>["emotionAnalysis"]
>;

class MusicService {
	// ── Track Fetching ────────────────────────────────────────────────────────────

	private async fetchCandidateTracks(): Promise<TrackWithArtists[]> {
		return prisma.track.findMany({
			where: {
				durationMs: { gte: 120000, lte: 420000 },
				valence: { not: null },
				energy: { not: null },
				acousticness: { not: null },
				danceability: { not: null },
				tempo: { not: null },
			},
			orderBy: { popularity: "desc" },
			take: 500,
			include: {
				artists: {
					include: { artist: { select: { name: true } } },
				},
			},
		});
	}

	// ── Persistence ───────────────────────────────────────────────────────────────

	private async persistRecommendation(
		userId: string,
		entryId: string,
		mode: RecommendationMode,
		orderedTracks: TrackWithArtists[],
		diagnostics: AlgorithmDiagnostics,
	): Promise<string> {
		return prisma.$transaction(async (tx) => {
			const rec = await tx.musicRecommendation.upsert({
				where: { entryId_mode: { entryId, mode } },
				create: { entryId, userId, mode, generatedAt: new Date(), diagnostics: diagnostics as unknown as Prisma.InputJsonValue },
				update: { generatedAt: new Date(), diagnostics: diagnostics as unknown as Prisma.InputJsonValue },
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

	private async fetchFormattedRecommendation(recommendationId: string) {
		const rec = await prisma.musicRecommendation.findUniqueOrThrow({
			where: { id: recommendationId },
			include: {
				tracks: {
					orderBy: { order: "asc" },
					include: {
						track: {
							include: {
								artists: {
									include: {
										artist: { select: { name: true } },
									},
								},
							},
						},
					},
				},
			},
		});

		const diagnostics = rec.diagnostics as AlgorithmDiagnostics | null;

		return {
			id: rec.id,
			entryId: rec.entryId,
			mode: rec.mode,
			generatedAt: rec.generatedAt,
			diagnostics,
			tracks: rec.tracks.map((rt) => {
				const diag = diagnostics?.trackDiagnostics.find((d) => d.trackId === rt.track.id) ?? null;
				return {
					order: rt.order,
					score: diag?.score ?? null,
					stage: diag?.stage ?? null,
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
						artists: rt.track.artists.map((ta) => ({
							name: ta.artist.name,
						})),
					},
				};
			}),
		};
	}

	// ── Core Generation ───────────────────────────────────────────────────────────

	private async generateAndPersist(
		userId: string,
		entryId: string,
		mode: RecommendationMode,
		analysis: EmotionAnalysisData,
		withJitter: boolean,
	): Promise<string> {
		const candidates = await this.fetchCandidateTracks();

		if (candidates.length === 0) {
			throw new AppError(
				"No eligible tracks available for recommendation",
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const { centroid, moodKey, isBlended } = resolveCentroid({
			primaryEmotion: analysis.primaryEmotion,
			confidence: analysis.confidence,
			intensity: analysis.intensity,
			emotionDistribution: analysis.emotionDistribution,
		});

		let orderedTracks: TrackWithArtists[];
		let trackDiagnostics: TrackDiagnostic[];
		let shiftParams: AlgorithmDiagnostics["shiftParams"];

		if (mode === RecommendationMode.MIRROR) {
			const result = runMirrorMode(candidates, centroid, withJitter);
			orderedTracks = result.tracks;
			trackDiagnostics = result.trackDiagnostics;
		} else {
			const result = runShiftMode(
				candidates,
				centroid,
				analysis.sentimentScore,
				withJitter,
			);
			orderedTracks = result.tracks;
			trackDiagnostics = result.trackDiagnostics;
			shiftParams = result.shiftParams;
		}

		const diagnostics: AlgorithmDiagnostics = {
			moodKey,
			isBlended,
			resolvedCentroid: centroid,
			trackDiagnostics,
			...(shiftParams && { shiftParams }),
		};

		const recommendationId = await this.persistRecommendation(
			userId,
			entryId,
			mode,
			orderedTracks,
			diagnostics,
		);

		// Mark music as completed — best-effort, entry may have been deleted
		await prisma.moodEntry
			.update({
				where: { id: entryId },
				data: { musicStatus: MusicStatus.COMPLETED },
			})
			.catch(() => {});

		return recommendationId;
	}

	// ── Entry Validation Helper ───────────────────────────────────────────────────

	private async validateEntryForRecommendation(
		userId: string,
		entryId: string,
	) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
			include: { emotionAnalysis: true },
		});

		if (!entry) throw new AppError("Entry not found", HttpStatus.NOT_FOUND);
		if (entry.userId !== userId)
			throw new AppError("Access denied", HttpStatus.FORBIDDEN);
		if (entry.analysisStatus !== "COMPLETED") {
			throw new AppError(
				"Emotion analysis is not completed for this entry",
				HttpStatus.CONFLICT,
			);
		}
		if (!entry.emotionAnalysis) {
			throw new AppError(
				"Emotion analysis data not found",
				HttpStatus.NOT_FOUND,
			);
		}

		// SHIFT mode for negative sentiment (< -0.2), MIRROR otherwise
		const mode: RecommendationMode =
			entry.emotionAnalysis.sentimentScore < -0.2
				? RecommendationMode.SHIFT
				: RecommendationMode.MIRROR;

		return { entry, analysis: entry.emotionAnalysis, mode };
	}

	// ── Public API ────────────────────────────────────────────────────────────────

	async getOrCreateRecommendation(
		userId: string,
		entryId: string,
	): Promise<Awaited<
		ReturnType<typeof this.fetchFormattedRecommendation>
	> | null> {
		const { entry, mode } = await this.validateEntryForRecommendation(
			userId,
			entryId,
		);

		// FAILED means auto-generation threw — tell the client to use refresh to retry
		if (entry.musicStatus === MusicStatus.FAILED) {
			throw new AppError(
				"Music generation failed for this entry. Use the refresh endpoint to retry.",
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const existing = await prisma.musicRecommendation.findUnique({
			where: { entryId_mode: { entryId, mode } },
		});

		if (!existing) {
			// Auto-generation is in progress — caller should retry shortly
			return null;
		}

		return this.fetchFormattedRecommendation(existing.id);
	}

	async refreshRecommendation(userId: string, entryId: string) {
		const { analysis, mode } = await this.validateEntryForRecommendation(
			userId,
			entryId,
		);

		const recommendationId = await this.generateAndPersist(
			userId,
			entryId,
			mode,
			analysis,
			true,
		);

		return this.fetchFormattedRecommendation(recommendationId);
	}

	async getRecentRecommendation(userId: string, limit: number) {
		const recs = await prisma.musicRecommendation.findMany({
			where: { userId },
			orderBy: { generatedAt: "desc" },
			take: limit,
			include: {
				entry: { select: { encryptedContent: true, contentIv: true } },
				tracks: {
					orderBy: { order: "asc" },
					include: {
						track: {
							include: {
								artists: {
									include: {
										artist: { select: { name: true } },
									},
								},
							},
						},
					},
				},
			},
		});

		const playlists = recs.map((rec) => {
			const diagnostics = rec.diagnostics as AlgorithmDiagnostics | null;
			const { title } = decryptEntry(rec.entry.encryptedContent, rec.entry.contentIv);
			return {
				id: rec.id,
				title,
				entryId: rec.entryId,
				mode: rec.mode,
				generatedAt: rec.generatedAt,
				diagnostics,
				tracks: rec.tracks.map((rt) => {
					const diag = diagnostics?.trackDiagnostics.find((d) => d.trackId === rt.track.id) ?? null;
					return {
						order: rt.order,
						score: diag?.score ?? null,
						stage: diag?.stage ?? null,
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
							artists: rt.track.artists.map((ta) => ({
								name: ta.artist.name,
							})),
						},
					};
				}),
			};
		});

		return { playlists };
	}

	/**
	 * Called fire-and-forget after emotion analysis completes.
	 * Generates the initial recommendation (no jitter) and persists it.
	 */
	async autoGenerateRecommendation(
		userId: string,
		entryId: string,
	): Promise<void> {
		try {
			const { analysis, mode } = await this.validateEntryForRecommendation(
				userId,
				entryId,
			);
			await prisma.moodEntry.update({
				where: { id: entryId },
				data: { musicStatus: MusicStatus.GENERATING },
			});
			await this.generateAndPersist(userId, entryId, mode, analysis, false);
			// musicStatus → COMPLETED is set inside generateAndPersist
		} catch (err) {
			await prisma.moodEntry
				.update({
					where: { id: entryId },
					data: {
						musicStatus: MusicStatus.FAILED,
						musicErrorReason: err instanceof Error ? err.message : String(err),
					},
				})
				.catch(() => {});
			throw err;
		}
	}
}

export const musicService = new MusicService();
