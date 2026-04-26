import prisma from "../config/database";
import { startOfDay, daysAgo } from "../utils/date.util";

class AdminStatsService {
	// ─────────────────────────────────────────
	// FR-25: Admin Overview
	// ─────────────────────────────────────────

	async getOverview() {
		const now = new Date();
		const todayStart = startOfDay(now);
		const weekStart = daysAgo(7);
		const monthStart = daysAgo(30);

		const [
			totalUsers,
			activeUsers,
			newToday,
			newThisWeek,
			newThisMonth,
			totalEntries,
			entriesToday,
			entriesThisWeek,
			entriesThisMonth,
			analyzedEntries,
			emotionDist,
		] = await Promise.all([
			prisma.user.count({ where: { role: "USER" } }),
			prisma.user.count({ where: { role: "USER", isActive: true } }),
			prisma.user.count({ where: { role: "USER", createdAt: { gte: todayStart } } }),
			prisma.user.count({ where: { role: "USER", createdAt: { gte: weekStart } } }),
			prisma.user.count({ where: { role: "USER", createdAt: { gte: monthStart } } }),
			prisma.moodEntry.count(),
			prisma.moodEntry.count({ where: { createdAt: { gte: todayStart } } }),
			prisma.moodEntry.count({ where: { createdAt: { gte: weekStart } } }),
			prisma.moodEntry.count({ where: { createdAt: { gte: monthStart } } }),
			prisma.moodEntry.count({ where: { analysisStatus: "COMPLETED" } }),
			prisma.emotionAnalysis.groupBy({
				by: ["primaryEmotion"],
				_count: { primaryEmotion: true },
				orderBy: { _count: { primaryEmotion: "desc" } },
			}),
		]);

		// Top 10 keywords (system-wide, last 30 days)
		const recentAnalyses = await prisma.emotionAnalysis.findMany({
			where: {
				entry: { createdAt: { gte: monthStart } },
			},
			select: { keywords: true },
			take: 2000,
		});

		const kwFreq = new Map<string, number>();
		for (const { keywords } of recentAnalyses) {
			for (const kw of keywords) {
				kwFreq.set(kw, (kwFreq.get(kw) ?? 0) + 1);
			}
		}
		const topKeywords = [...kwFreq.entries()]
			.map(([keyword, count]) => ({ keyword, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		return {
			users: {
				total: totalUsers,
				active: activeUsers,
				inactive: totalUsers - activeUsers,
				newToday,
				newThisWeek,
				newThisMonth,
			},
			entries: {
				total: totalEntries,
				today: entriesToday,
				thisWeek: entriesThisWeek,
				thisMonth: entriesThisMonth,
				analyzed: analyzedEntries,
			},
			emotionDistribution: emotionDist.map((e) => ({
				emotion: e.primaryEmotion,
				count: e._count.primaryEmotion,
			})),
			topKeywords,
		};
	}

	// ─────────────────────────────────────────
	// FR-25: Admin Music Stats
	// ─────────────────────────────────────────

	async getMusicStats(limit: number) {
		const [recGroups, playGroups, genreGroups, modeGroups] = await Promise.all([
			prisma.recommendationTrack.groupBy({
				by: ["trackId"],
				_count: { trackId: true },
				orderBy: { _count: { trackId: "desc" } },
				take: limit,
			}),
			prisma.trackPlay.groupBy({
				by: ["trackId"],
				_count: { trackId: true },
				orderBy: { _count: { trackId: "desc" } },
				take: limit,
			}),
			prisma.trackGenre.groupBy({
				by: ["genreId"],
				_count: { genreId: true },
				orderBy: { _count: { genreId: "desc" } },
				take: 20,
			}),
			prisma.musicRecommendation.groupBy({
				by: ["mode"],
				_count: { mode: true },
			}),
		]);

		// Fetch track details for top recommended
		const recTrackIds = recGroups.map((r) => r.trackId);
		const playTrackIds = playGroups.map((p) => p.trackId);
		const genreIds = genreGroups.map((g) => g.genreId);

		const [recTracks, playTracks, genres] = await Promise.all([
			prisma.track.findMany({
				where: { id: { in: recTrackIds } },
				select: {
					id: true,
					trackName: true,
					albumName: true,
					artists: { select: { artist: { select: { name: true } } } },
				},
			}),
			prisma.track.findMany({
				where: { id: { in: playTrackIds } },
				select: {
					id: true,
					trackName: true,
					albumName: true,
					artists: { select: { artist: { select: { name: true } } } },
				},
			}),
			prisma.genre.findMany({
				where: { id: { in: genreIds } },
				select: { id: true, name: true },
			}),
		]);

		const recTrackMap = new Map(recTracks.map((t) => [t.id, t]));
		const playTrackMap = new Map(playTracks.map((t) => [t.id, t]));
		const genreMap = new Map(genres.map((g) => [g.id, g.name]));

		const topRecommended = recGroups
			.map((r) => ({
				track: recTrackMap.get(r.trackId),
				recommendationCount: r._count.trackId,
			}))
			.filter((r) => r.track !== undefined);

		const topPlayed = playGroups
			.map((p) => ({
				track: playTrackMap.get(p.trackId),
				playCount: p._count.trackId,
			}))
			.filter((p) => p.track !== undefined);

		const genreDistribution = genreGroups
			.map((g) => ({
				genre: genreMap.get(g.genreId) ?? g.genreId,
				count: g._count.genreId,
			}));

		const recommendationModes = modeGroups.map((m) => ({
			mode: m.mode,
			count: m._count.mode,
		}));

		return {
			topRecommended,
			topPlayed,
			genreDistribution,
			recommendationModes,
		};
	}
}

export const adminStatsService = new AdminStatsService();
