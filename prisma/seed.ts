import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Theme, type UserRole } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { createCipheriv, randomBytes, randomUUID } from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

type Delta = { ops: Array<{ insert: string }> };

type SeedUser = {
	id: string;
	email: string;
	username: string;
	name: string;
	password: string;
	role: UserRole;
	theme: Theme;
};

type SeedEntry = {
	id: string;
	userEmail: string;
	title: string;
	content: string;
	entryDate: string;
	tags: string[];
	isPrivate: boolean;
	inputMethod: "TEXT" | "VOICE";
};

type SeedMoodTag = {
	name: string;
	color: string;
};

const adminSeed: SeedUser = {
	id: randomUUID(),
	email: "admin@moodnote.com",
	username: "admin",
	name: "Admin",
	password: "Admin@123456",
	role: "ADMIN",
	theme: "DARK",
};

const demoUsers: SeedUser[] = [
	{
		id: randomUUID(),
		email: "toanhuynhlilyiu@gmail.com",
		username: "tonjiji",
		name: "Toan Huynh",
		password: "Toanhuynh0201@",
		role: "USER",
		theme: "SYSTEM",
	},
];

const seedUsers: SeedUser[] = [adminSeed, ...demoUsers];

const seedMoodTags: SeedMoodTag[] = [
	{ name: "vui-ve", color: "#FFD700" },
	{ name: "cong-viec", color: "#4A90E2" },
	{ name: "ban-be", color: "#7ED321" },
	{ name: "thu-gian", color: "#9B59B6" },
	{ name: "met-moi", color: "#95A5A6" },
];

const seedEntries: SeedEntry[] = Array.from({ length: 30 }).map((_, index) => {
	const day = index + 1;
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - (29 - index)); // 29 days ago → today
	d.setUTCHours(8, 0, 0, 0);
	const date = d.toISOString();
	const id = randomUUID();

	const titles = [
		"Một ngày nhẹ nhàng",
		"Năng lượng ngập tràn",
		"Hơi mệt một chút",
		"Ngày dài lê thê",
		"Tuyệt vời!",
	];

	const contents = [
		"Hôm nay mình cảm thấy khá thoải mái, công việc hoàn thành đúng hạn và có thời gian thư giãn.",
		"Một ngày rất năng suất, giải quyết được nhiều việc tồn đọng. Cảm thấy rất có động lực.",
		"Công việc hôm nay khá áp lực, nhưng cuối cùng mọi thứ cũng ổn thỏa. Buổi tối mình dành thời gian nghỉ ngơi.",
		"Ngày hôm nay trôi qua khá chậm. Không có gì đặc biệt xảy ra, mình chỉ muốn ngủ một giấc thật ngon.",
		"Gặp được những người bạn cũ, trò chuyện vui vẻ. Hôm nay thật sự là một ngày tuyệt vời.",
	];

	const allTags = ["vui-ve", "cong-viec", "ban-be", "thu-gian", "met-moi"];
	const randomTags = [allTags[index % 5], allTags[(index + 1) % 5]];

	return {
		id,
		userEmail: "toanhuynhlilyiu@gmail.com",
		title: titles[index % 5] + ` - Ngày ${day}`,
		content: contents[index % 5],
		entryDate: date,
		tags: randomTags,
		isPrivate: index % 3 === 0,
		inputMethod: index % 4 === 0 ? "VOICE" : "TEXT",
	};
});

function assertEncryptionKey(): string {
	if (!ENCRYPTION_KEY) {
		throw new Error("ENCRYPTION_KEY is required to seed mood entries");
	}

	return ENCRYPTION_KEY;
}

function createDelta(content: string): Delta {
	return { ops: [{ insert: content }] };
}

function calcWordCount(content: string): number {
	return content.trim().split(/\s+/).filter(Boolean).length;
}

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 12);
}

function encryptContent(
	plaintext: string,
	keyHex: string,
): {
	ciphertext: string;
	iv: string;
} {
	const key = Buffer.from(keyHex, "hex");
	const iv = randomBytes(16);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return {
		ciphertext: Buffer.concat([authTag, encrypted]).toString("base64"),
		iv: iv.toString("hex"),
	};
}

async function main() {
	const encryptionKey = assertEncryptionKey();

	const hashedUsers = await Promise.all(
		seedUsers.map(async (user) => ({
			...user,
			password: await hashPassword(user.password),
		})),
	);

	await prisma.$transaction(async (tx) => {
		const userEmails = seedUsers.map((user) => user.email);
		const moodTagNames = seedMoodTags.map((tag) => tag.name);

		const existingUsers = await tx.user.findMany({
			where: { email: { in: userEmails } },
			select: { id: true },
		});

		const existingUserIds = existingUsers.map((u) => u.id);

		if (existingUserIds.length > 0) {
			await tx.moodEntry.deleteMany({
				where: { userId: { in: existingUserIds } },
			});
		}

		await tx.entryTag.deleteMany({
			where: { tag: { name: { in: moodTagNames } } },
		});
		await tx.moodTag.deleteMany({
			where: { name: { in: moodTagNames } },
		});

		await tx.user.deleteMany({
			where: { email: { in: userEmails } },
		});

		await tx.moodTag.createMany({
			data: seedMoodTags,
			skipDuplicates: true,
		});

		const seededMoodTags = await tx.moodTag.findMany({
			where: { name: { in: moodTagNames } },
			select: { id: true, name: true },
		});
		const moodTagMap = new Map(
			seededMoodTags.map((tag) => [tag.name, tag.id]),
		);

		const seededUsers = new Map<
			string,
			{ id: string; email: string; username: string }
		>();

		for (const user of hashedUsers) {
			const savedUser = await tx.user.create({
				data: {
					id: user.id,
					email: user.email,
					username: user.username,
					name: user.name,
					password: user.password,
					role: user.role,
					isEmailVerified: true,
					isActive: true,
				},
			});

			seededUsers.set(user.email, {
				id: savedUser.id,
				email: savedUser.email,
				username: savedUser.username,
			});

			await tx.userSettings.create({
				data: {
					userId: savedUser.id,
					theme: user.theme,
					language: "vi",
				},
			});
		}

		for (const entry of seedEntries) {
			const owner = seededUsers.get(entry.userEmail);
			if (!owner) {
				throw new Error(
					`Missing seeded user for entry owner: ${entry.userEmail}`,
				);
			}

			const entryTags = entry.tags
				.map((tagName) => moodTagMap.get(tagName))
				.filter((tagId): tagId is string => !!tagId);

			const payload = {
				title: entry.title,
				content: createDelta(entry.content),
			};
			const { ciphertext, iv } = encryptContent(
				JSON.stringify(payload),
				encryptionKey,
			);

			await tx.moodEntry.upsert({
				where: { id: entry.id },
				create: {
					id: entry.id,
					userId: owner.id,
					encryptedContent: ciphertext,
					contentIv: iv,
					wordCount: calcWordCount(entry.content),
					entryDate: new Date(entry.entryDate),
					inputMethod: entry.inputMethod,
					isPrivate: entry.isPrivate,
					analysisStatus: "FAILED",
					moodTags: {
						create: entryTags.map((tagId) => ({
							tag: { connect: { id: tagId } },
						})),
					},
				},
				update: {
					userId: owner.id,
					encryptedContent: ciphertext,
					contentIv: iv,
					wordCount: calcWordCount(entry.content),
					entryDate: new Date(entry.entryDate),
					inputMethod: entry.inputMethod,
					isPrivate: entry.isPrivate,
					analysisStatus: "PENDING",
					moodTags: {
						deleteMany: {},
						create: entryTags.map((tagId) => ({
							tag: { connect: { id: tagId } },
						})),
					},
				},
			});
		}
	});

	const userCount = await prisma.user.count({
		where: { email: { in: seedUsers.map((user) => user.email) } },
	});
	const entryCount = await prisma.moodEntry.count({
		where: { id: { in: seedEntries.map((entry) => entry.id) } },
	});

	console.log("✓ Basic seed complete");
	console.log(`  Users : ${userCount}`);
	console.log(`  Entries: ${entryCount}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
		await pool.end();
	});
