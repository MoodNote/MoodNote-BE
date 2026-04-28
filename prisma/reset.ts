import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const resetOrder = [
	"trackPlay",
	"playlistTrack",
	"recommendationTrack",
	"entryTag",
	"trackArtist",
	"trackGenre",
	"emotionAnalysis",
	"musicRecommendation",
	"playlist",
	"moodEntry",
	"notification",
	"notificationSettings",
	"deviceToken",
	"userSettings",
	"userStats",
	"refreshToken",
	"moodTag",
	"track",
	"artist",
	"genre",
	"user",
] as const;

type PrismaDelegate = {
	deleteMany: () => Promise<unknown>;
};

async function main() {
	console.log("⚠️  Resetting database...");

	const operations = resetOrder
		.map((modelName) => prisma[modelName as keyof typeof prisma])
		.filter((delegate): delegate is PrismaDelegate => {
			return (
				!!delegate &&
				typeof delegate === "object" &&
				"deleteMany" in delegate
			);
		})
		.map((delegate) => delegate.deleteMany);

	for (const deleteMany of operations) {
		await deleteMany();
	}

	console.log("✓ All tables cleared");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
