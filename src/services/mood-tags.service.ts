import prisma from "../config/database";

class MoodTagsService {
	async listTags() {
		const tags = await prisma.moodTag.findMany({
			orderBy: { name: "asc" },
			select: { id: true, name: true, color: true, type: true },
		});
		return {
			moodTags: tags.filter((t) => t.type === "MOOD"),
			lifeTags: tags.filter((t) => t.type === "LIFE"),
		};
	}
}

export const moodTagsService = new MoodTagsService();
