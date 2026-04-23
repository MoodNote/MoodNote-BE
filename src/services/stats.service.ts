import prisma from "../config/database";
import { countStreakFromToday } from "../utils/date.util";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface DateRangeParams {
	range?: string;
	startDate?: string;
	endDate?: string;
}

interface EmotionCounts {
	Enjoyment: number;
	Sadness: number;
	Anger: number;
	Fear: number;
	Disgust: number;
	Surprise: number;
	Other: number;
}

// ─────────────────────────────────────────
// Service
// ─────────────────────────────────────────

class StatsService {
	private readonly TIME_PERIODS = [
		{ period: "morning", hours: "6-11", min: 6, max: 11 },
		{ period: "afternoon", hours: "12-17", min: 12, max: 17 },
		{ period: "evening", hours: "18-22", min: 18, max: 22 },
		{ period: "night", hours: "23-5", min: 23, max: 5 },
	] as const;

	private readonly DAY_NAMES = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	] as const;

	private readonly VN_DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

	private resolveDateRange(params: DateRangeParams): {
		start: Date;
		end: Date;
		days: number;
	} {
		const end = params.endDate
			? new Date(params.endDate + "T23:59:59.999Z")
			: new Date();
		const days = parseInt(params.range ?? "30");
		const start = params.startDate
			? new Date(params.startDate + "T00:00:00.000Z")
			: new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
		const actualDays = Math.round(
			(end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
		);
		return { start, end, days: actualDays };
	}

	private initEmotionCounts(): EmotionCounts {
		return {
			Enjoyment: 0,
			Sadness: 0,
			Anger: 0,
			Fear: 0,
			Disgust: 0,
			Surprise: 0,
			Other: 0,
		};
	}

	private dominantEmotion(counts: EmotionCounts): string {
		return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
	}

	private getTimePeriod(hour: number): (typeof this.TIME_PERIODS)[number] {
		for (const p of this.TIME_PERIODS) {
			if (p.period === "night") {
				if (hour >= 23 || hour <= 5) return p;
			} else {
				if (hour >= p.min && hour <= p.max) return p;
			}
		}
		return this.TIME_PERIODS[3]; // night as fallback
	}

	// ─────────────────────────────────────────
	// FR-18: Emotion Chart
	// ─────────────────────────────────────────

	async getEmotionChart(userId: string, params: DateRangeParams) {
		const { start, end, days } = this.resolveDateRange(params);

		const entries = await prisma.moodEntry.findMany({
			where: {
				userId,
				entryDate: { gte: start, lte: end },
				analysisStatus: "COMPLETED",
				emotionAnalysis: { isNot: null },
			},
			select: {
				id: true,
				entryDate: true,
				emotionAnalysis: {
					select: { sentimentScore: true, primaryEmotion: true },
				},
			},
			orderBy: { entryDate: "asc" },
		});

		const dataPoints = entries.map((e) => ({
			date: e.entryDate.toISOString().split("T")[0],
			sentimentScore: e.emotionAnalysis!.sentimentScore,
			primaryEmotion: e.emotionAnalysis!.primaryEmotion,
			entryId: e.id,
		}));

		const scores = dataPoints.map((d) => d.sentimentScore);
		const averageSentiment =
			scores.length > 0
				? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) /
					1000
				: null;

		let trend: "up" | "down" | "stable" = "stable";
		if (scores.length >= 2) {
			const mid = Math.floor(scores.length / 2);
			const firstHalf = scores.slice(0, mid);
			const secondHalf = scores.slice(mid);
			const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
			const secondAvg =
				secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
			const diff = secondAvg - firstAvg;
			if (diff > 0.1) trend = "up";
			else if (diff < -0.1) trend = "down";
		}

		return {
			range: {
				startDate: start.toISOString().split("T")[0],
				endDate: end.toISOString().split("T")[0],
				days,
			},
			dataPoints,
			summary: {
				averageSentiment,
				trend,
				totalEntries: dataPoints.length,
			},
		};
	}

	// ─────────────────────────────────────────
	// FR-19: Keywords
	// ─────────────────────────────────────────

	async getKeywords(
		userId: string,
		params: DateRangeParams & { limit?: number },
	) {
		const { start, end, days } = this.resolveDateRange(params);
		const limit = params.limit ?? 10;

		const analyses = await prisma.emotionAnalysis.findMany({
			where: {
				entry: {
					userId,
					entryDate: { gte: start, lte: end },
					analysisStatus: "COMPLETED",
				},
			},
			select: { keywords: true, entryId: true },
		});

		const freq = new Map<string, { count: number; entryIds: string[] }>();
		for (const { keywords, entryId } of analyses) {
			for (const kw of keywords) {
				const cur = freq.get(kw) ?? { count: 0, entryIds: [] };
				cur.count++;
				if (!cur.entryIds.includes(entryId)) cur.entryIds.push(entryId);
				freq.set(kw, cur);
			}
		}

		const keywords = [...freq.entries()]
			.map(([keyword, { count, entryIds }]) => ({ keyword, count, entryIds }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);

		return {
			keywords,
			totalAnalyzed: analyses.length,
			range: {
				startDate: start.toISOString().split("T")[0],
				endDate: end.toISOString().split("T")[0],
				days,
			},
		};
	}

	// ─────────────────────────────────────────
	// FR-20: Patterns (simplified)
	// ─────────────────────────────────────────

	async getPatterns(userId: string, params: { range?: string }) {
		const days = parseInt(params.range ?? "30");
		const end = new Date();
		const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

		const entries = await prisma.moodEntry.findMany({
			where: {
				userId,
				entryDate: { gte: start, lte: end },
				analysisStatus: "COMPLETED",
				emotionAnalysis: { isNot: null },
			},
			select: {
				entryDate: true,
				createdAt: true,
				emotionAnalysis: {
					select: { primaryEmotion: true, sentimentScore: true },
				},
			},
		});

		if (entries.length < 10) {
			return { hasEnoughData: false, totalEntries: entries.length };
		}

		// By day of week
		const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
			dayIndex: i,
			day: this.DAY_NAMES[i],
			totalEntries: 0,
			emotionCounts: this.initEmotionCounts(),
			sentimentSum: 0,
			averageSentiment: 0,
			dominantEmotion: "Other",
		}));

		// By time of day
		const byTimeOfDay = this.TIME_PERIODS.map((p) => ({
			period: p.period,
			hours: p.hours,
			totalEntries: 0,
			emotionCounts: this.initEmotionCounts(),
			sentimentSum: 0,
			averageSentiment: 0,
			dominantEmotion: "Other",
		}));

		for (const entry of entries) {
			if (!entry.emotionAnalysis) continue;
			const emotion = entry.emotionAnalysis.primaryEmotion as keyof EmotionCounts;
			const score = entry.emotionAnalysis.sentimentScore;

			// Day of week (use entryDate — the day the mood belongs to)
			const dayIdx = entry.entryDate.getUTCDay();
			byDayOfWeek[dayIdx].totalEntries++;
			byDayOfWeek[dayIdx].emotionCounts[emotion]++;
			byDayOfWeek[dayIdx].sentimentSum += score;

			// Time of day (use createdAt — when the user actually wrote the entry)
			const hour = entry.createdAt.getHours();
			const timePeriod = this.getTimePeriod(hour);
			const timeSlot = byTimeOfDay.find((t) => t.period === timePeriod.period)!;
			timeSlot.totalEntries++;
			timeSlot.emotionCounts[emotion]++;
			timeSlot.sentimentSum += score;
		}

		// Compute averages and dominant emotions
		for (const day of byDayOfWeek) {
			if (day.totalEntries > 0) {
				day.averageSentiment =
					Math.round((day.sentimentSum / day.totalEntries) * 1000) / 1000;
				day.dominantEmotion = this.dominantEmotion(day.emotionCounts);
			}
		}
		for (const slot of byTimeOfDay) {
			if (slot.totalEntries > 0) {
				slot.averageSentiment =
					Math.round((slot.sentimentSum / slot.totalEntries) * 1000) / 1000;
				slot.dominantEmotion = this.dominantEmotion(slot.emotionCounts);
			}
		}

		// Strip internal sentimentSum field
		const cleanDays = byDayOfWeek.map(
			({ sentimentSum: _s, ...rest }) => rest,
		);
		const cleanSlots = byTimeOfDay.map(
			({ sentimentSum: _s, ...rest }) => rest,
		);

		return {
			hasEnoughData: true,
			totalEntries: entries.length,
			byDayOfWeek: cleanDays,
			byTimeOfDay: cleanSlots,
		};
	}

	// ─────────────────────────────────────────
	// Home: Summary (streaks)
	// ─────────────────────────────────────────

	async recomputeAndSaveStreaks(userId: string): Promise<void> {
		const cutoff = new Date();
		cutoff.setUTCDate(cutoff.getUTCDate() - 365);
		cutoff.setUTCHours(0, 0, 0, 0);

		const entries = await prisma.moodEntry.findMany({
			where: { userId, entryDate: { gte: cutoff } },
			select: {
				entryDate: true,
				analysisStatus: true,
				emotionAnalysis: { select: { primaryEmotion: true } },
			},
		});

		const writingDates = new Set<string>();
		const emotionByDate = new Map<string, string>();
		for (const entry of entries) {
			const dateStr = entry.entryDate.toISOString().split("T")[0];
			writingDates.add(dateStr);
			if (!emotionByDate.has(dateStr) && entry.analysisStatus === "COMPLETED" && entry.emotionAnalysis) {
				emotionByDate.set(dateStr, entry.emotionAnalysis.primaryEmotion);
			}
		}

		const writingStreak = countStreakFromToday((d) => writingDates.has(d));
		const smileStreak = countStreakFromToday((d) => emotionByDate.get(d) === "Enjoyment");
		const sadStreak = countStreakFromToday((d) => emotionByDate.get(d) === "Sadness");

		await prisma.userStats.upsert({
			where: { userId },
			create: { userId, writingStreak, smileStreak, sadStreak },
			update: { writingStreak, smileStreak, sadStreak },
		});
	}

	async getSummary(userId: string) {
		const stats = await prisma.userStats.findUnique({ where: { userId } });
		const today = new Date().toISOString().split("T")[0];

		if (stats && stats.updatedAt.toISOString().split("T")[0] === today) {
			return {
				writingStreak: stats.writingStreak,
				smileStreak: stats.smileStreak,
				sadStreak: stats.sadStreak,
			};
		}

		// No row yet, or row is from a previous day (midnight passed) — recompute
		await this.recomputeAndSaveStreaks(userId);
		const fresh = await prisma.userStats.findUnique({ where: { userId } });
		return {
			writingStreak: fresh?.writingStreak ?? 0,
			smileStreak: fresh?.smileStreak ?? 0,
			sadStreak: fresh?.sadStreak ?? 0,
		};
	}

	// ─────────────────────────────────────────
	// Báo cáo: Weekly emotion chart
	// ─────────────────────────────────────────

	async getWeeklyChart(userId: string, params: { startDate?: string }) {
		let start: Date;
		if (params.startDate) {
			start = new Date(params.startDate + "T00:00:00.000Z");
		} else {
			start = new Date();
			start.setUTCHours(0, 0, 0, 0);
			// Go back to Monday (UTC: 0=Sun, 1=Mon, ..., 6=Sat)
			const day = start.getUTCDay();
			const daysFromMonday = day === 0 ? 6 : day - 1;
			start.setUTCDate(start.getUTCDate() - daysFromMonday);
		}

		const end = new Date(start);
		end.setUTCDate(start.getUTCDate() + 6);
		end.setUTCHours(23, 59, 59, 999);

		const entries = await prisma.moodEntry.findMany({
			where: {
				userId,
				entryDate: { gte: start, lte: end },
				analysisStatus: "COMPLETED",
				emotionAnalysis: { isNot: null },
			},
			select: {
				entryDate: true,
				createdAt: true,
				emotionAnalysis: {
					select: { primaryEmotion: true, sentimentScore: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Keep only the latest entry per date
		const byDate = new Map<string, { emotion: string; sentimentScore: number }>();
		for (const entry of entries) {
			const dateStr = entry.entryDate.toISOString().split("T")[0];
			if (!byDate.has(dateStr)) {
				byDate.set(dateStr, {
					emotion: entry.emotionAnalysis!.primaryEmotion,
					sentimentScore: entry.emotionAnalysis!.sentimentScore,
				});
			}
		}

		const days = Array.from({ length: 7 }, (_, i) => {
			const day = new Date(start);
			day.setUTCDate(start.getUTCDate() + i);
			const dateStr = day.toISOString().split("T")[0];
			const data = byDate.get(dateStr);
			return {
				date: dateStr,
				dayLabel: this.VN_DAY_LABELS[day.getUTCDay()],
				emotion: data?.emotion ?? null,
				sentimentScore: data?.sentimentScore ?? null,
				hasEntry: !!data,
			};
		});

		const startD = start.getUTCDate();
		const startM = start.getUTCMonth() + 1;
		const endD = end.getUTCDate();
		const endM = end.getUTCMonth() + 1;
		const weekLabel = `${startD}/${startM} - ${endD}/${endM}`;

		return {
			weekLabel,
			startDate: start.toISOString().split("T")[0],
			endDate: end.toISOString().split("T")[0],
			days,
		};
	}

	// ─────────────────────────────────────────
	// Báo cáo: Monthly calendar
	// ─────────────────────────────────────────

	async getMonthlyCalendar(
		userId: string,
		params: { year: number; month: number },
	) {
		const { year, month } = params;

		const now = new Date();
		const currentYear = now.getUTCFullYear();
		const currentMonth = now.getUTCMonth() + 1;
		if (year > currentYear || (year === currentYear && month > currentMonth)) {
			throw new AppError("Cannot retrieve calendar for future months", HttpStatus.BAD_REQUEST);
		}

		// new Date(UTC(year, month, 0)) = last day of the month
		const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
		const end = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

		const entries = await prisma.moodEntry.findMany({
			where: {
				userId,
				entryDate: { gte: start, lte: end },
				analysisStatus: "COMPLETED",
				emotionAnalysis: { isNot: null },
			},
			select: {
				entryDate: true,
				createdAt: true,
				emotionAnalysis: { select: { primaryEmotion: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		// Keep only the latest entry per date
		const byDate = new Map<string, string>();
		for (const entry of entries) {
			const dateStr = entry.entryDate.toISOString().split("T")[0];
			if (!byDate.has(dateStr)) {
				byDate.set(dateStr, entry.emotionAnalysis!.primaryEmotion);
			}
		}

		const days = Array.from({ length: daysInMonth }, (_, i) => {
			const d = i + 1;
			const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
			const emotion = byDate.get(dateStr) ?? null;
			return { date: dateStr, day: d, emotion, hasEntry: !!emotion };
		});

		return { year, month, daysInMonth, days };
	}
}

export const statsService = new StatsService();
