import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";
import { handlePrismaError } from "../utils/prisma.util";
import { calcSkip, buildPagination } from "../utils/pagination.util";

interface CreateTagInput {
	name: string;
	color?: string;
}

interface UpdateTagInput {
	name?: string;
	color?: string | null;
}

interface ListTagsQuery {
	page: number;
	limit: number;
	search?: string;
}

class AdminMoodTagsService {
	async createTag(data: CreateTagInput) {
		try {
			return await prisma.moodTag.create({ data });
		} catch (error) {
			handlePrismaError(error);
		}
	}

	async listTags(query: ListTagsQuery) {
		const { page, limit, search } = query;
		const skip = calcSkip(page, limit);

		const where = search
			? { name: { contains: search, mode: "insensitive" as const } }
			: {};

		const [tags, total] = await Promise.all([
			prisma.moodTag.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take: limit,
			}),
			prisma.moodTag.count({ where }),
		]);

		return { tags, pagination: buildPagination(total, page, limit) };
	}

	async getTag(id: string) {
		const tag = await prisma.moodTag.findUnique({ where: { id } });
		if (!tag) throw new AppError("Mood tag not found", HttpStatus.NOT_FOUND);
		return tag;
	}

	async updateTag(id: string, data: UpdateTagInput) {
		const existing = await prisma.moodTag.findUnique({ where: { id } });
		if (!existing) throw new AppError("Mood tag not found", HttpStatus.NOT_FOUND);

		try {
			return await prisma.moodTag.update({ where: { id }, data });
		} catch (error) {
			handlePrismaError(error);
		}
	}

	async deleteTag(id: string) {
		const existing = await prisma.moodTag.findUnique({ where: { id } });
		if (!existing) throw new AppError("Mood tag not found", HttpStatus.NOT_FOUND);

		await prisma.moodTag.delete({ where: { id } });
	}
}

export const adminMoodTagsService = new AdminMoodTagsService();
