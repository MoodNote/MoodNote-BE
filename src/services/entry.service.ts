import prisma from "../config/database";
import { calcSkip, buildPagination } from "../utils/pagination.util";
import { encrypt } from "../utils/encryption.util";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";
import { decryptEntry, extractPlainText } from "../utils/entry.util";
import { Prisma } from "@prisma/client";
import { pipelineService } from "./pipeline.service";
import { statsService } from "./stats.service";
import type { Delta, EntryPayload } from "../types/entry.types";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

type EntryWithTags = Prisma.MoodEntryGetPayload<{
	include: { moodTags: { include: { tag: true } } };
}>;

class EntryService {
	private calcWordCount(plainText: string): number {
		return plainText.trim().split(/\s+/).filter(Boolean).length;
	}

	private formatEntryResponse(
		entry: EntryWithTags,
		payload: EntryPayload,
		includeFullContent: boolean,
		preview?: string,
		emotionAnalysis?: Prisma.EmotionAnalysisGetPayload<object> | null,
	) {
		const base = {
			id: entry.id,
			title: payload.title,
			entryDate: entry.entryDate,
			inputMethod: entry.inputMethod,
			tags: entry.moodTags.map((et) => et.tag),
			wordCount: entry.wordCount,
			isPrivate: entry.isPrivate,
			analysisStatus: entry.analysisStatus,
			musicStatus: entry.musicStatus,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt,
			emotionAnalysis: emotionAnalysis ?? null,
		};

		if (includeFullContent) {
			return { ...base, content: payload.content };
		}
		return { ...base, preview };
	}

	async createEntry(
		userId: string,
		data: {
			title?: string;
			content: Delta;
			entryDate?: string;
			inputMethod?: "TEXT" | "VOICE";
			tagIds?: string[];
			isPrivate?: boolean;
		},
	) {
		// Default entryDate to today (start of day UTC)
		let entryDate: Date;
		if (data.entryDate) {
			entryDate = new Date(data.entryDate);
		} else {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			entryDate = today;
		}

		// Reject future dates
		const now = new Date();
		now.setHours(23, 59, 59, 999);
		if (entryDate > now) {
			throw new AppError("Entry date cannot be in the future", HttpStatus.BAD_REQUEST);
		}

		const tagIds = data.tagIds ?? [];
		if (tagIds.length > 0) {
			const found = await prisma.moodTag.findMany({
				where: { id: { in: tagIds } },
				select: { id: true },
			});
			if (found.length !== tagIds.length) {
				throw new AppError("One or more tag IDs are invalid", HttpStatus.BAD_REQUEST);
			}
		}

		const plainText = extractPlainText(data.content);
		const wordCount = this.calcWordCount(plainText);

		const payload: EntryPayload = {
			title: data.title ?? null,
			content: data.content,
		};

		const { ciphertext, iv } = encrypt(
			JSON.stringify(payload),
			ENCRYPTION_KEY,
		);

		const entry = await prisma.moodEntry.create({
			data: {
				userId,
				encryptedContent: ciphertext,
				contentIv: iv,
				wordCount,
				entryDate,
				inputMethod: (data.inputMethod ?? "TEXT") as "TEXT" | "VOICE",
				isPrivate: data.isPrivate ?? false,
				analysisStatus: "PENDING",
				moodTags: { create: tagIds.map((tagId) => ({ tagId })) },
			},
			include: { moodTags: { include: { tag: true } } },
		});

		// Fire-and-forget AI analysis — response is not blocked
		pipelineService.onEntryNeedsAnalysis(entry.id);
		statsService.recomputeAndSaveStreaks(userId).catch((err) =>
			console.warn("[Entry] Streak update failed:", err instanceof Error ? err.message : String(err)),
		);

		return this.formatEntryResponse(entry, payload, true);
	}

	async listEntries(
		userId: string,
		query: {
			page: number;
			limit: number;
			startDate?: string;
			endDate?: string;
			tagIds?: string;
			analysisStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
		},
	) {
		const { page, limit, startDate, endDate, tagIds, analysisStatus } = query;
		const skip = calcSkip(page, limit);

		const where: Prisma.MoodEntryWhereInput = { userId };

		if (startDate || endDate) {
			where.entryDate = {};
			if (startDate) where.entryDate.gte = new Date(startDate);
			if (endDate) {
				const end = new Date(endDate);
				end.setHours(23, 59, 59, 999);
				where.entryDate.lte = end;
			}
		}

		if (tagIds) {
			const tagIdList = tagIds
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);
			if (tagIdList.length > 0) {
				where.moodTags = { some: { tagId: { in: tagIdList } } };
			}
		}

		if (analysisStatus) {
			where.analysisStatus = analysisStatus;
		}

		const [entries, total] = await prisma.$transaction([
			prisma.moodEntry.findMany({
				where,
				orderBy: { entryDate: "desc" },
				skip,
				take: limit,
				include: { emotionAnalysis: true, moodTags: { include: { tag: true } } },
			}),
			prisma.moodEntry.count({ where }),
		]);

		const formattedEntries = entries.map((entry) => {
			try {
				const payload = decryptEntry(entry.encryptedContent, entry.contentIv);
				const plainText = extractPlainText(payload.content);
				const preview =
					plainText.length > 30
						? plainText.slice(0, 30) + "..."
						: plainText;
				return this.formatEntryResponse(entry, payload, false, preview, entry.emotionAnalysis);
			} catch (err) {
				console.error(
					`[Entry] Failed to decrypt entry ${entry.id}:`,
					err instanceof Error ? err.message : String(err),
				);
				return this.formatEntryResponse(
					entry,
					{ title: null, content: { ops: [] } },
					false,
					"",
					entry.emotionAnalysis,
				);
			}
		});

		return {
			entries: formattedEntries,
			pagination: buildPagination(total, page, limit),
		};
	}

	async getEntry(userId: string, entryId: string) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
			include: { emotionAnalysis: true, moodTags: { include: { tag: true } } },
		});

		if (!entry) {
			throw new AppError("Entry not found", HttpStatus.NOT_FOUND);
		}

		if (entry.userId !== userId) {
			throw new AppError("Access denied", HttpStatus.FORBIDDEN);
		}

		const payload = decryptEntry(entry.encryptedContent, entry.contentIv);

		return this.formatEntryResponse(
			entry,
			payload,
			true,
			undefined,
			entry.emotionAnalysis,
		);
	}

	async updateEntry(
		userId: string,
		entryId: string,
		data: {
			title?: string;
			content?: Delta;
			tagIds?: string[];
			isPrivate?: boolean;
		},
	) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
		});

		if (!entry) {
			throw new AppError("Entry not found", HttpStatus.NOT_FOUND);
		}

		if (entry.userId !== userId) {
			throw new AppError("Access denied", HttpStatus.FORBIDDEN);
		}

		const hasUpdatableFields =
			data.title !== undefined ||
			data.content !== undefined ||
			data.tagIds !== undefined ||
			data.isPrivate !== undefined;

		if (!hasUpdatableFields) {
			throw new AppError("No fields to update", HttpStatus.BAD_REQUEST);
		}

		if (data.tagIds !== undefined && data.tagIds.length > 0) {
			const found = await prisma.moodTag.findMany({
				where: { id: { in: data.tagIds } },
				select: { id: true },
			});
			if (found.length !== data.tagIds.length) {
				throw new AppError("One or more tag IDs are invalid", HttpStatus.BAD_REQUEST);
			}
		}

		const updateData: Parameters<
			typeof prisma.moodEntry.update
		>[0]["data"] = {};

		if (data.title !== undefined || data.content !== undefined) {
			// Decrypt current payload and merge
			const currentPayload = decryptEntry(entry.encryptedContent, entry.contentIv);

			const newPayload: EntryPayload = {
				title:
					data.title !== undefined
						? data.title || null
						: currentPayload.title,
				content: data.content ?? currentPayload.content,
			};

			const { ciphertext, iv } = encrypt(
				JSON.stringify(newPayload),
				ENCRYPTION_KEY,
			);
			updateData.encryptedContent = ciphertext;
			updateData.contentIv = iv;

			if (data.content !== undefined) {
				const plainText = extractPlainText(data.content);
				updateData.wordCount = this.calcWordCount(plainText);
				updateData.analysisStatus = "PENDING";
			}
		}

		if (data.tagIds !== undefined) {
			updateData.moodTags = {
				deleteMany: {},
				createMany: { data: data.tagIds.map((tagId) => ({ tagId })) },
			};
		}
		if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;

		const contentChanged = data.content !== undefined;

		const [updated] = await prisma.$transaction([
			prisma.moodEntry.update({
				where: { id: entryId },
				data: updateData,
				include: { moodTags: { include: { tag: true } } },
			}),
			...(contentChanged
				? [prisma.emotionAnalysis.deleteMany({ where: { entryId } })]
				: []),
		]);

		// Fire-and-forget re-analysis when content changed
		if (contentChanged) {
			pipelineService.onEntryNeedsAnalysis(updated.id);
		}

		const payload = decryptEntry(updated.encryptedContent, updated.contentIv);

		return this.formatEntryResponse(updated, payload, true);
	}

	async bulkDeleteEntries(userId: string, ids: string[]) {
		const result = await prisma.moodEntry.deleteMany({
			where: { id: { in: ids }, userId },
		});
		statsService.recomputeAndSaveStreaks(userId).catch((err) =>
			console.warn("[Entry] Streak update failed:", err instanceof Error ? err.message : String(err)),
		);
		return { deletedCount: result.count };
	}

	async deleteEntry(userId: string, entryId: string) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
		});

		if (!entry) {
			throw new AppError("Entry not found", HttpStatus.NOT_FOUND);
		}

		if (entry.userId !== userId) {
			throw new AppError("Access denied", HttpStatus.FORBIDDEN);
		}

		await prisma.moodEntry.delete({ where: { id: entryId } });
		await statsService.recomputeAndSaveStreaks(userId).catch((err) =>
			console.error(
				"[Entry] Streak update failed after delete:",
				err instanceof Error ? err.message : String(err),
			),
		);

		return { message: "Entry deleted successfully" };
	}
}

export const entryService = new EntryService();
