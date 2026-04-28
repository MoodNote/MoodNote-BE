import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";
import { Theme, Prisma, EmotionType } from "@prisma/client";
import { passwordUtil } from "../utils/password.util";
import { decryptEntry } from "../utils/entry.util";
import { encrypt } from "../utils/encryption.util";
import { statsService } from "./stats.service";

type ImportEntry = {
	entryDate: string;
	createdAt?: string;
	inputMethod?: "TEXT" | "VOICE";
	wordCount?: number;
	content?: {
		title?: string | null;
		content: { ops: Array<{ insert: string | Record<string, unknown>; attributes?: Record<string, unknown> }> };
	} | null;
	analysis?: {
		primaryEmotion: string;
		sentimentScore: number;
		intensity: number;
		confidence: number;
		emotionDistribution: Record<string, number>;
		keywords: string[];
		analyzedAt: string;
	} | null;
};

type ImportDataInput = {
	entries?: ImportEntry[];
	settings?: { theme?: "LIGHT" | "DARK" | "SYSTEM"; language?: string };
};

class UserService {
	private readonly profileSelect = {
		id: true,
		email: true,
		username: true,
		name: true,
		isEmailVerified: true,
		createdAt: true,
		updatedAt: true,
	};

	private readonly settingsSelect = {
		theme: true,
		language: true,
		updatedAt: true,
	};

	async getProfile(userId: string) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: this.profileSelect,
		});

		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);

		return user;
	}

	async updateProfile(
		userId: string,
		data: { name?: string; username?: string },
	) {
		if (data.username) {
			const existing = await prisma.user.findFirst({
				where: { username: data.username, NOT: { id: userId } },
				select: { id: true },
			});
			if (existing) throw new AppError("Username already taken", HttpStatus.CONFLICT);
		}

		const updated = await prisma.user.update({
			where: { id: userId },
			data,
			select: this.profileSelect,
		});

		return { message: "Profile updated successfully", data: updated };
	}

	async getSettings(userId: string) {
		return prisma.userSettings.upsert({
			where: { userId },
			create: { userId },
			update: {},
			select: this.settingsSelect,
		});
	}

	async updateSettings(userId: string, data: { theme?: Theme; language?: string }) {
		return prisma.userSettings.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
			select: this.settingsSelect,
		});
	}

	async exportData(userId: string) {
		const [user, settings, entries] = await Promise.all([
			prisma.user.findUnique({
				where: { id: userId },
				select: { id: true, email: true, username: true, name: true, isEmailVerified: true, createdAt: true },
			}),
			prisma.userSettings.findUnique({
				where: { userId },
				select: { theme: true, language: true },
			}),
			prisma.moodEntry.findMany({
				where: { userId },
				select: {
					encryptedContent: true,
					contentIv: true,
					wordCount: true,
					entryDate: true,
					inputMethod: true,
					createdAt: true,
					emotionAnalysis: {
						select: {
							primaryEmotion: true,
							sentimentScore: true,
							intensity: true,
							confidence: true,
							emotionDistribution: true,
							keywords: true,
							analyzedAt: true,
						},
					},
				},
				orderBy: { entryDate: "asc" },
			}),
		]);

		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);

		const decryptedEntries = entries.map(({ encryptedContent, contentIv, emotionAnalysis, ...rest }) => {
			let content = null;
			try {
				content = decryptEntry(encryptedContent, contentIv);
			} catch {
				// return null content if decryption fails for a single entry
			}
			return { ...rest, content, analysis: emotionAnalysis ?? null };
		});

		return {
			exportedAt: new Date().toISOString(),
			profile: user,
			settings: settings ?? { theme: "SYSTEM", language: "vi" },
			entries: decryptedEntries,
		};
	}

	async importData(userId: string, { entries = [], settings }: ImportDataInput) {
		let settingsUpdated = false;
		let importedEntries = 0;
		let skippedEntries = 0;

		if (settings && (settings.theme !== undefined || settings.language !== undefined)) {
			await prisma.userSettings.upsert({
				where: { userId },
				create: { userId, ...settings },
				update: settings,
			});
			settingsUpdated = true;
		}

		const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

		for (const entry of entries) {
			if (!entry.content) {
				skippedEntries++;
				continue;
			}

			const { ciphertext, iv } = encrypt(JSON.stringify(entry.content), ENCRYPTION_KEY);

			await prisma.$transaction(async (tx) => {
				const newEntry = await tx.moodEntry.create({
					data: {
						userId,
						encryptedContent: ciphertext,
						contentIv: iv,
						wordCount: entry.wordCount ?? 0,
						entryDate: new Date(entry.entryDate),
						inputMethod: (entry.inputMethod ?? "TEXT") as "TEXT" | "VOICE",
						...(entry.createdAt ? { createdAt: new Date(entry.createdAt) } : {}),
						analysisStatus: entry.analysis ? "COMPLETED" : "PENDING",
						musicStatus: "PENDING",
					},
				});

				if (entry.analysis) {
					await tx.emotionAnalysis.create({
						data: {
							entryId: newEntry.id,
							primaryEmotion: entry.analysis.primaryEmotion as EmotionType,
							sentimentScore: entry.analysis.sentimentScore,
							intensity: entry.analysis.intensity,
							confidence: entry.analysis.confidence,
							emotionDistribution: entry.analysis.emotionDistribution as Prisma.InputJsonValue,
							keywords: entry.analysis.keywords,
							analyzedAt: new Date(entry.analysis.analyzedAt),
						},
					});
				}
			});

			importedEntries++;
		}

		if (importedEntries > 0) {
			statsService.recomputeAndSaveStreaks(userId).catch(() => {});
		}

		return { importedEntries, skippedEntries, settingsUpdated };
	}

	async deleteAccount(userId: string, password: string) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { password: true },
		});

		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);

		const isMatch = await passwordUtil.compare(password, user.password);
		if (!isMatch) throw new AppError("Incorrect password", HttpStatus.UNAUTHORIZED);

		await prisma.user.delete({ where: { id: userId } });
	}
}

export const userService = new UserService();
