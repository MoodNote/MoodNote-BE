import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
	const email = "admin@moodnote.com";
	const password = "Admin@123456";

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		console.log(`Admin already exists: ${email}`);
		return;
	}

	const hashedPassword = await bcrypt.hash(password, 12);

	const admin = await prisma.user.create({
		data: {
			email,
			username: "admin",
			name: "Admin",
			password: hashedPassword,
			role: "ADMIN",
			isEmailVerified: true,
			isActive: true,
		},
	});

	console.log("✓ Admin account created:");
	console.log(`  Email   : ${admin.email}`);
	console.log(`  Username: ${admin.username}`);
	console.log(`  Password: ${password}`);
	console.log(`  Role    : ${admin.role}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
