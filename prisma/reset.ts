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

async function main() {
	console.log("⚠️  Resetting database...");

	for (const modelName of resetOrder) {
		const delegate = prisma[modelName as keyof typeof prisma] as unknown as {
			deleteMany: () => Promise<{ count: number }>;
		};
		await delegate.deleteMany();
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
