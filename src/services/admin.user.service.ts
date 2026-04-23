import prisma from "../config/database";
import { countStreakFromToday, daysAgo } from "../utils/date.util";
import { calcSkip, buildPagination } from "../utils/pagination.util";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";

interface ListUsersOptions {
	page: number;
	limit: number;
	search?: string;
	isActive?: boolean;
}

class AdminUserService {
	async listUsers(opts: ListUsersOptions) {
		const { page, limit, search, isActive } = opts;
		const skip = calcSkip(page, limit);

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
			pagination: buildPagination(total, page, limit),
		};
	}

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

		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);

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
				streakDays: (() => {
					const dateSet = new Set(
						entries.map((e) => e.entryDate.toISOString().split("T")[0]),
					);
					return countStreakFromToday((d) => dateSet.has(d));
				})(),
			},
		};
	}

	async getEmotionDistribution(userId: string, period: number) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);

		const periodStart = daysAgo(period);

		const groups = await prisma.emotionAnalysis.groupBy({
			by: ["primaryEmotion"],
			where: {
				entry: {
					userId,
					createdAt: { gte: periodStart },
				},
			},
			_count: { primaryEmotion: true },
			orderBy: { _count: { primaryEmotion: "desc" } },
		});

		const total = groups.reduce((sum, g) => sum + g._count.primaryEmotion, 0);

		const distribution = groups.map((g) => ({
			emotion: g.primaryEmotion,
			count: g._count.primaryEmotion,
			percentage: total > 0
				? Math.round((g._count.primaryEmotion / total) * 10000) / 100
				: 0,
		}));

		return { userId, period, distribution };
	}

	async updateUserStatus(id: string, isActive: boolean) {
		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, role: true },
		});

		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);
		if (user.role === "ADMIN")
			throw new AppError("Cannot change status of admin accounts", HttpStatus.FORBIDDEN);

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
	}
}

export const adminUserService = new AdminUserService();
