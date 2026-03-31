import prisma from "../config/database";

function calculateStreak(entryDates: Date[]): number {
	if (entryDates.length === 0) return 0;

	const uniqueDates = [
		...new Set(entryDates.map((d) => d.toISOString().split("T")[0])),
	]
		.sort()
		.reverse();

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	let streak = 0;
	for (let i = 0; i < uniqueDates.length; i++) {
		const expected = new Date(today);
		expected.setUTCDate(today.getUTCDate() - i);
		if (uniqueDates[i] === expected.toISOString().split("T")[0]) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}

interface ListUsersOptions {
	page: number;
	limit: number;
	search?: string;
	isActive?: boolean;
}

export const adminUserService = {
	async listUsers(opts: ListUsersOptions) {
		const { page, limit, search, isActive } = opts;
		const skip = (page - 1) * limit;

		const where = {
			...(isActive !== undefined && { isActive }),
			...(search && {
				OR: [
					{ email: { contains: search, mode: "insensitive" as const } },
					{ username: { contains: search, mode: "insensitive" as const } },
					{ name: { contains: search, mode: "insensitive" as const } },
				],
			}),
		};

		const [users, total] = await Promise.all([
			prisma.user.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				select: {
					id: true,
					email: true,
					username: true,
					name: true,
					role: true,
					isActive: true,
					isEmailVerified: true,
					lastLoginAt: true,
					createdAt: true,
					_count: {
						select: { moodEntries: true },
					},
				},
			}),
			prisma.user.count({ where }),
		]);

		return {
			users: users.map((u) => ({
				id: u.id,
				email: u.email,
				username: u.username,
				name: u.name,
				role: u.role,
				isActive: u.isActive,
				isEmailVerified: u.isEmailVerified,
				lastLoginAt: u.lastLoginAt,
				createdAt: u.createdAt,
				entryCount: u._count.moodEntries,
			})),
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		};
	},

	async getUserDetail(id: string) {
		const [user, entries] = await Promise.all([
			prisma.user.findUnique({
				where: { id },
				select: {
					id: true,
					email: true,
					username: true,
					name: true,
					role: true,
					isActive: true,
					isEmailVerified: true,
					lastLoginAt: true,
					createdAt: true,
					_count: { select: { moodEntries: true } },
				},
			}),
			prisma.moodEntry.findMany({
				where: { userId: id },
				select: { entryDate: true },
			}),
		]);

		if (!user) throw new Error("User not found");

		return {
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				name: user.name,
				role: user.role,
				isActive: user.isActive,
				isEmailVerified: user.isEmailVerified,
				lastLoginAt: user.lastLoginAt,
				createdAt: user.createdAt,
				entryCount: user._count.moodEntries,
				streakDays: calculateStreak(entries.map((e) => e.entryDate)),
			},
		};
	},

	async updateUserStatus(id: string, isActive: boolean) {
		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, role: true },
		});

		if (!user) throw new Error("User not found");
		if (user.role === "ADMIN")
			throw new Error("Cannot change status of admin accounts");

		if (!isActive) {
			await prisma.$transaction([
				prisma.user.update({ where: { id }, data: { isActive: false } }),
				prisma.refreshToken.updateMany({
					where: { userId: id },
					data: { isRevoked: true },
				}),
			]);
		} else {
			await prisma.user.update({ where: { id }, data: { isActive: true } });
		}

		return { userId: id, isActive };
	},
};
