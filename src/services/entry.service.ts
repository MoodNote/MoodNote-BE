import prisma from "../config/database";
import { encrypt, decrypt } from "../utils/encryption.util";
import { AppError } from "../utils/app-error.util";
import { Prisma } from "@prisma/client";
import { analysisService } from "./analysis.service";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

interface DeltaOp {
	insert: string | Record<string, unknown>;
	attributes?: Record<string, unknown>;
}

interface Delta {
	ops: DeltaOp[];
}

// title is NOT a separate DB column — it is stored inside encryptedContent
// alongside the Quill Delta, so it benefits from the same field-level encryption.
interface EntryPayload {
	title: string | null;
	content: Delta;
}

function extractPlainText(delta: Delta): string {
	return delta.ops
		.filter((op) => typeof op.insert === "string")
		.map((op) => op.insert as string)
		.join("")
		.trim();
}

function calcWordCount(plainText: string): number {
	return plainText.trim().split(/\s+/).filter(Boolean).length;
}

function formatEntryResponse(
	entry: Prisma.MoodEntryGetPayload<object>,
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
		tags: entry.tags,
		wordCount: entry.wordCount,
		isPrivate: entry.isPrivate,
		analysisStatus: entry.analysisStatus,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
		emotionAnalysis: emotionAnalysis ?? null,
	};

	if (includeFullContent) {
		return { ...base, content: payload.content };
	}
	return { ...base, preview };
}

export const entryService = {
	async createEntry(
		userId: string,
		data: {
			title?: string;
			content: Delta;
			entryDate?: string;
			inputMethod?: "TEXT" | "VOICE";
			tags?: string[];
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
			throw new Error("Entry date cannot be in the future");
		}

		const plainText = extractPlainText(data.content);
		const wordCount = calcWordCount(plainText);

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
				tags: data.tags ?? [],
				isPrivate: data.isPrivate ?? false,
				analysisStatus: "PENDING",
			},
		});

		// Fire-and-forget AI analysis — response is not blocked
		analysisService
			.runAnalysis(entry.id)
			.catch((err) =>
				console.error("[Entry] Failed to start analysis:", err),
			);

		return formatEntryResponse(entry, payload, true);
	},

	async listEntries(
		userId: string,
		query: {
			page: number;
			limit: number;
			startDate?: string;
			endDate?: string;
			tags?: string;
			analysisStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
		},
	) {
		const { page, limit, startDate, endDate, tags, analysisStatus } = query;
		const skip = (page - 1) * limit;

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

		if (tags) {
			const tagList = tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);
			if (tagList.length > 0) {
				where.tags = { hasSome: tagList };
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
			}),
			prisma.moodEntry.count({ where }),
		]);

		const formattedEntries = entries.map((entry) => {
			try {
				const decrypted = decrypt(
					entry.encryptedContent,
					entry.contentIv,
					ENCRYPTION_KEY,
				);
				const payload: EntryPayload = JSON.parse(decrypted);
				const plainText = extractPlainText(payload.content);
				const preview =
					plainText.length > 30
						? plainText.slice(0, 30) + "..."
						: plainText;
				return formatEntryResponse(entry, payload, false, preview);
			} catch {
				// If decryption fails, return entry without content
				return formatEntryResponse(
					entry,
					{ title: null, content: { ops: [] } },
					false,
					"",
				);
			}
		});

		return {
			entries: formattedEntries,
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	async getEntry(userId: string, entryId: string) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
			include: { emotionAnalysis: true },
		});

		if (!entry) {
			throw new AppError("Entry not found", 404);
		}

		if (entry.userId !== userId) {
			throw new AppError("Access denied", 403);
		}

		const decrypted = decrypt(
			entry.encryptedContent,
			entry.contentIv,
			ENCRYPTION_KEY,
		);
		const payload: EntryPayload = JSON.parse(decrypted);

		return formatEntryResponse(
			entry,
			payload,
			true,
			undefined,
			entry.emotionAnalysis,
		);
	},

	async updateEntry(
		userId: string,
		entryId: string,
		data: {
			title?: string;
			content?: Delta;
			tags?: string[];
			isPrivate?: boolean;
		},
	) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
		});

		if (!entry) {
			throw new AppError("Entry not found", 404);
		}

		if (entry.userId !== userId) {
			throw new AppError("Access denied", 403);
		}

		const hasUpdatableFields =
			data.title !== undefined ||
			data.content !== undefined ||
			data.tags !== undefined ||
			data.isPrivate !== undefined;

		if (!hasUpdatableFields) {
			throw new Error("No fields to update");
		}

		const updateData: Parameters<
			typeof prisma.moodEntry.update
		>[0]["data"] = {};

		if (data.title !== undefined || data.content !== undefined) {
			// Decrypt current payload and merge
			const decrypted = decrypt(
				entry.encryptedContent,
				entry.contentIv,
				ENCRYPTION_KEY,
			);
			const currentPayload: EntryPayload = JSON.parse(decrypted);

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
				updateData.wordCount = calcWordCount(plainText);
				updateData.analysisStatus = "PENDING";
			}
		}

		if (data.tags !== undefined) updateData.tags = data.tags;
		if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;

		const contentChanged = data.content !== undefined;

		const [updated] = await prisma.$transaction([
			prisma.moodEntry.update({
				where: { id: entryId },
				data: updateData,
			}),
			...(contentChanged
				? [prisma.emotionAnalysis.deleteMany({ where: { entryId } })]
				: []),
		]);

		// Fire-and-forget re-analysis when content changed
		if (contentChanged) {
			analysisService
				.runAnalysis(updated.id)
				.catch((err) =>
					console.error("[Entry] Failed to restart analysis:", err),
				);
		}

		const decrypted = decrypt(
			updated.encryptedContent,
			updated.contentIv,
			ENCRYPTION_KEY,
		);
		const payload: EntryPayload = JSON.parse(decrypted);

		return formatEntryResponse(updated, payload, true);
	},

	async bulkDeleteEntries(userId: string, ids: string[]) {
		const result = await prisma.moodEntry.deleteMany({
			where: { id: { in: ids }, userId },
		});
		return { deletedCount: result.count };
	},

	async deleteEntry(userId: string, entryId: string) {
		const entry = await prisma.moodEntry.findUnique({
			where: { id: entryId },
		});

		if (!entry) {
			throw new AppError("Entry not found", 404);
		}

		if (entry.userId !== userId) {
			throw new AppError("Access denied", 403);
		}

		await prisma.moodEntry.delete({ where: { id: entryId } });

		return { message: "Entry deleted successfully" };
	},
};
