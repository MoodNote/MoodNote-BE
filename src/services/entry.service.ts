import prisma from "../config/database";
import { encrypt, decrypt } from "../utils/encryption.util";
import { Prisma } from "@prisma/client";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

interface DeltaOp {
	insert: string | Record<string, unknown>;
	attributes?: Record<string, unknown>;
}

interface Delta {
	ops: DeltaOp[];
}

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
		});

		if (!entry) {
			throw new Error("Entry not found");
		}

		if (entry.userId !== userId) {
			throw new Error("Access denied");
		}

		const decrypted = decrypt(
			entry.encryptedContent,
			entry.contentIv,
			ENCRYPTION_KEY,
		);
		const payload: EntryPayload = JSON.parse(decrypted);

		return formatEntryResponse(entry, payload, true);
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
			throw new Error("Entry not found");
		}

		if (entry.userId !== userId) {
			throw new Error("Access denied");
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
				updateData.aiAnalysisId = null;
			}
		}

		if (data.tags !== undefined) updateData.tags = data.tags;
		if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;

		const updated = await prisma.moodEntry.update({
			where: { id: entryId },
			data: updateData,
		});

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
			throw new Error("Entry not found");
		}

		if (entry.userId !== userId) {
			throw new Error("Access denied");
		}

		await prisma.moodEntry.delete({ where: { id: entryId } });

		return { message: "Entry deleted successfully" };
	},
};
