import prisma from "../config/database";

class MoodTagsService {
	async listTags() {
		return prisma.moodTag.findMany({
			orderBy: { name: "asc" },
			select: { id: true, name: true, color: true },
		});
	}
}

export const moodTagsService = new MoodTagsService();
