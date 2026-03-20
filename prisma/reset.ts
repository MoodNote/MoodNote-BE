import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
	console.log("⚠️  Resetting database...");

	await prisma.$transaction([
		prisma.notification.deleteMany(),
		prisma.notificationSettings.deleteMany(),
		prisma.deviceToken.deleteMany(),
		prisma.moodEntry.deleteMany(),
		prisma.emailVerification.deleteMany(),
		prisma.passwordReset.deleteMany(),
		prisma.refreshToken.deleteMany(),
		prisma.user.deleteMany(),
	]);

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
