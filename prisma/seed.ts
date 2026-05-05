import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Theme, type UserRole, type TagType } from "@prisma/client";
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
	type: TagType;
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
	{ name: "Vui vẻ", color: "#FFD700", type: "MOOD" },
	{ name: "Buồn bã", color: "#5B7FA6", type: "MOOD" },
	{ name: "Tức giận", color: "#E74C3C", type: "MOOD" },
	{ name: "Lo lắng", color: "#E8A838", type: "MOOD" },
	{ name: "Chán ghét", color: "#95A5A6", type: "MOOD" },
	{ name: "Ngạc nhiên", color: "#9B59B6", type: "MOOD" },
	{ name: "Khác", color: "#BDBDBD", type: "MOOD" },
	{ name: "Công việc", color: "#4A90E2", type: "LIFE" },
	{ name: "Học tập", color: "#27AE60", type: "LIFE" },
	{ name: "Bạn bè", color: "#7ED321", type: "LIFE" },
	{ name: "Gia đình", color: "#FF7F50", type: "LIFE" },
	{ name: "Sức khỏe", color: "#2ECC71", type: "LIFE" },
	{ name: "Thư giãn", color: "#FF69B4", type: "LIFE" },
	{ name: "Tình yêu", color: "#E91E63", type: "LIFE" },
	{ name: "Du lịch", color: "#1ABC9C", type: "LIFE" },
];

const titles = [
	"Một ngày nhẹ nhàng",
	"Năng lượng ngập tràn",
	"Hơi mệt một chút",
	"Ngày dài lê thê",
	"Tuyệt vời!",
	"Suy nghĩ lan man",
	"Buổi sáng bình yên",
	"Cảm xúc lẫn lộn",
	"Ngày đáng nhớ",
	"Khoảnh khắc nhỏ",
];

const contents = [
	"Hôm nay mình cảm thấy khá thoải mái và nhẹ nhàng. Công việc hoàn thành đúng hạn, không có gì quá căng thẳng. Buổi chiều mình tranh thủ ra ngoài đi dạo một vòng, hít thở không khí trong lành. Cảm giác cơ thể được thư giãn thật sự rất tốt. Tối về nấu bữa cơm đơn giản, ngồi ăn một mình nhưng lại thấy bình yên theo cách riêng của nó. Ngày mai lại là một ngày mới, mình sẽ cố gắng duy trì trạng thái này.",

	"Một ngày cực kỳ năng suất! Mình giải quyết được hầu hết những việc còn tồn đọng từ tuần trước. Cảm giác tick vào từng mục trong danh sách việc cần làm mang lại sự thỏa mãn rất lớn. Buổi sáng bắt đầu bằng một ly cà phê đen và một bản nhạc nhẹ, thế là đủ để vào guồng làm việc. Chiều hôm nay mình còn kịp hoàn thành một dự án nhỏ mà đã dự định mãi chưa làm. Cảm thấy bản thân có giá trị và đang đi đúng hướng.",

	"Công việc hôm nay khá áp lực, deadline dồn dập và nhiều thứ chồng chất lên nhau. Mình ngồi làm từ sáng đến chiều gần như không có nghỉ giữa giờ. Đầu óc mệt mỏi nhưng vẫn cố gắng hoàn thành phần việc quan trọng nhất. Cuối cùng mọi thứ cũng ổn thỏa, dù chưa hoàn hảo nhưng tạm ổn. Buổi tối mình quyết định tắt máy sớm hơn bình thường, pha một tách trà nóng và ngồi xem phim để xả stress. Ngày mai nhìn lại sẽ nhẹ hơn thôi.",

	"Ngày hôm nay trôi qua khá chậm và uể oải. Không có gì đặc biệt xảy ra, công việc cũng không nhiều nhưng mình lại không có hứng làm gì cả. Cứ ngồi nhìn màn hình mà đầu óc trống rỗng. Mình nghĩ có lẽ cơ thể đang cần nghỉ ngơi thật sự, không phải kiểu ngồi không mà nghĩ ngợi linh tinh. Chiều tối mình nằm xuống ngủ một giấc ngắn, tỉnh dậy cảm thấy nhẹ hơn một chút. Ngày mai cần bắt đầu lại từ sáng sớm cho có khí thế.",

	"Hôm nay gặp lại mấy người bạn cũ từ hồi đại học, vui không thể tả! Mình cứ tưởng mọi thứ sẽ awkward sau mấy năm không gặp, nhưng hóa ra khi ngồi lại với nhau thì câu chuyện cứ thế tuôn ra không dứt. Ăn uống, cười đùa, kể lại đủ thứ kỷ niệm cũ. Cảm giác thời gian như quay ngược lại, mình trẻ trung hơn hẳn. Đêm về nhà mà vẫn còn cười một mình khi nhớ lại mấy chuyện vui. Cuộc sống cần những khoảnh khắc như thế này.",

	"Mình dành cả buổi sáng ngồi đọc sách bên cửa sổ, ánh nắng buổi sớm vừa đủ ấm không quá chói. Cuốn sách mình đang đọc có nhiều đoạn khiến mình phải dừng lại suy nghĩ, không vội vàng lật trang tiếp mà ngồi nhấm nháp ý nghĩa một lúc. Cảm giác bình yên và nhẹ nhõm lạ thường, như thể mọi lo toan của cuộc sống tạm thời dừng lại. Buổi chiều ra ngoài đi bộ trong công viên, hít thở không khí xanh mát. Đây là kiểu ngày mình muốn có thêm nhiều hơn trong cuộc đời.",

	"Hôm nay mình có một chút lo lắng về tương lai, những câu hỏi cứ quẩn quanh trong đầu không dứt. Mình đang đi đúng hướng không? Những lựa chọn mình đã làm có phải là tốt nhất? Ngồi một lúc rồi mình quyết định ghi lại những gì đang làm mình lo ra giấy, nhìn vào từng điểm một thay vì để chúng trộn lẫn trong đầu. Khi nhìn trực tiếp vào từng vấn đề thì tự nhiên thấy bớt áp đảo hơn. Mình cũng nhắn tin cho một người bạn tâm sự, cảm ơn vì luôn có người lắng nghe.",

	"Tối nay cả nhà ngồi lại ăn cơm và trò chuyện, một bữa cơm đơn giản nhưng đầy ấm áp. Ba mẹ kể chuyện hồi xưa, mình và em ngồi nghe, thỉnh thoảng xen vào hỏi thêm. Những khoảnh khắc như thế này mình luôn trân trọng vì biết rằng không phải lúc nào cũng có thể sum họp như vậy. Sau bữa cơm mình pha trà cho ba rồi ngồi nói chuyện thêm một lúc. Cuộc sống bận rộn đôi khi khiến mình quên đi những điều giản dị như thế này mới thực sự quý giá.",

	"Hôm nay mình đặt báo thức sớm và bắt đầu ngày mới bằng bài tập thể dục. Ban đầu cũng ngại, muốn nằm thêm mười lăm phút nữa, nhưng rồi cố gắng bật dậy. Sau buổi tập mình cảm thấy cơ thể nhẹ nhàng và đầu óc tỉnh táo hơn hẳn. Năng lượng tốt kéo dài suốt cả ngày, làm việc hiệu quả hơn và tâm trạng cũng tích cực hơn. Cần duy trì thói quen này mỗi sáng, dù chỉ ba mươi phút thôi nhưng sự khác biệt rõ rệt lắm. Cảm ơn bản thân đã không lười biếng.",

	"Mình ghé thử một quán cà phê mới mở gần nhà, không gian yên tĩnh và trang trí theo phong cách tối giản rất thích. Gọi một ly americano nóng, lấy góc ngồi cạnh cửa sổ nhìn ra đường phố. Một mình nhưng không cô đơn, mình mang theo cuốn sổ và ghi chép lại những suy nghĩ lung tung trong đầu. Cảm giác được một mình trong không gian đẹp và yên tĩnh thật ra cũng cần thiết như những buổi gặp bạn bè. Đồ uống ngon, không gian dễ chịu, nhân viên thân thiện — chắc chắn sẽ quay lại.",
];

const entryHours = [7, 9, 12, 14, 17, 20, 22];

const allTagNames = seedMoodTags.map((t) => t.name);

const seedEntries: SeedEntry[] = Array.from({ length: 60 }).map((_, index) => {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - (59 - index));
	d.setUTCHours(entryHours[index % entryHours.length], 0, 0, 0);

	return {
		id: randomUUID(),
		userEmail: "toanhuynhlilyiu@gmail.com",
		title: titles[index % 10] + ` - Ngày ${index + 1}`,
		content: contents[index % 10],
		entryDate: d.toISOString(),
		tags: [allTagNames[index % 15], allTagNames[(index + 3) % 15]],
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
): { ciphertext: string; iv: string } {
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
	const startTime = Date.now();
	const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

	console.log("[Seed] Starting MoodNote seed...\n");

	// Step 1: Hash passwords
	let stepStart = Date.now();
	console.log(`[1/5] Hashing passwords for ${seedUsers.length} users...`);
	const hashedUsers = await Promise.all(
		seedUsers.map(async (user) => ({
			...user,
			password: await hashPassword(user.password),
		})),
	);
	console.log(`[1/5] Done. (${((Date.now() - stepStart) / 1000).toFixed(1)}s)\n`);

	await prisma.$transaction(async (tx) => {
		// Step 2: Clean existing seed data
		stepStart = Date.now();
		console.log("[2/5] Cleaning existing seed data...");

		const userEmails = seedUsers.map((u) => u.email);
		const tagNames = seedMoodTags.map((t) => t.name);

		const existingUsers = await tx.user.findMany({
			where: { email: { in: userEmails } },
			select: { id: true },
		});
		const existingUserIds = existingUsers.map((u) => u.id);

		let deletedEntries = { count: 0 };
		if (existingUserIds.length > 0) {
			deletedEntries = await tx.moodEntry.deleteMany({
				where: { userId: { in: existingUserIds } },
			});
		}
		const deletedEntryTags = await tx.entryTag.deleteMany({
			where: { tag: { name: { in: tagNames } } },
		});
		const deletedTags = await tx.moodTag.deleteMany({
			where: { name: { in: tagNames } },
		});
		const deletedUsers = await tx.user.deleteMany({
			where: { email: { in: userEmails } },
		});

		console.log(`      - Deleted ${deletedEntries.count} mood entries`);
		console.log(`      - Deleted ${deletedEntryTags.count} entry tags`);
		console.log(`      - Deleted ${deletedTags.count} mood tags`);
		console.log(`      - Deleted ${deletedUsers.count} users`);
		console.log(`[2/5] Done. (${((Date.now() - stepStart) / 1000).toFixed(1)}s)\n`);

		// Step 3: Create mood tags
		stepStart = Date.now();
		const moodCount = seedMoodTags.filter((t) => t.type === "MOOD").length;
		const lifeCount = seedMoodTags.filter((t) => t.type === "LIFE").length;
		console.log(`[3/5] Creating ${seedMoodTags.length} mood tags (${moodCount} MOOD, ${lifeCount} LIFE)...`);

		await tx.moodTag.createMany({ data: seedMoodTags, skipDuplicates: true });

		const createdTags = await tx.moodTag.findMany({
			where: { name: { in: tagNames } },
			select: { id: true, name: true },
		});
		const tagMap = new Map(createdTags.map((t) => [t.name, t.id]));

		console.log(`[3/5] Done. (${((Date.now() - stepStart) / 1000).toFixed(1)}s)\n`);

		// Step 4: Create users
		stepStart = Date.now();
		console.log(`[4/5] Creating ${hashedUsers.length} users with settings...`);

		const seededUsers = new Map<string, { id: string }>();

		for (const user of hashedUsers) {
			const saved = await tx.user.create({
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

			seededUsers.set(user.email, { id: saved.id });

			await tx.userSettings.create({
				data: { userId: saved.id, theme: user.theme, language: "vi" },
			});

			console.log(`      - ${user.email} (${user.role})`);
		}

		console.log(`[4/5] Done. (${((Date.now() - stepStart) / 1000).toFixed(1)}s)\n`);

		// Step 5: Create entries
		stepStart = Date.now();
		console.log(`[5/5] Creating ${seedEntries.length} entries...`);

		const encryptionKey = assertEncryptionKey();

		const entriesByUser = new Map<string, number>();
		for (const entry of seedEntries) {
			entriesByUser.set(entry.userEmail, (entriesByUser.get(entry.userEmail) ?? 0) + 1);
		}
		for (const [email, count] of entriesByUser) {
			console.log(`      - ${email}: ${count} entries`);
		}

		for (const entry of seedEntries) {
			const owner = seededUsers.get(entry.userEmail);
			if (!owner) {
				throw new Error(`Missing seeded user for entry owner: ${entry.userEmail}`);
			}

			const entryTagIds = entry.tags
				.map((name) => tagMap.get(name))
				.filter((id): id is string => !!id);

			const payload = { title: entry.title, content: createDelta(entry.content) };
			const { ciphertext, iv } = encryptContent(JSON.stringify(payload), encryptionKey);

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
						create: entryTagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
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
						create: entryTagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
					},
				},
			});
		}

		console.log(`[5/5] Done. (${((Date.now() - stepStart) / 1000).toFixed(1)}s)\n`);
	});

	const adminCount = seedUsers.filter((u) => u.role === "ADMIN").length;
	const demoCount = seedUsers.filter((u) => u.role === "USER").length;

	console.log(`[Seed] Complete in ${elapsed()}`);
	console.log(`       Users   : ${seedUsers.length} (${adminCount} admin, ${demoCount} demo)`);
	console.log(`       Tags    : ${seedMoodTags.length} (${seedMoodTags.filter((t) => t.type === "MOOD").length} MOOD, ${seedMoodTags.filter((t) => t.type === "LIFE").length} LIFE)`);
	console.log(`       Entries : ${seedEntries.length}`);
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
