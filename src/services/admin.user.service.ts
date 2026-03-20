import prisma from "../config/database";

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
};
