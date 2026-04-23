import prisma from "../config/database";
import { AppError } from "../utils/app-error.util";
import { HttpStatus } from "../utils/http-status.util";
import { Theme } from "@prisma/client";

class UserService {
	private readonly profileSelect = {
		id: true,
		email: true,
		username: true,
		name: true,
		isEmailVerified: true,
		createdAt: true,
		updatedAt: true,
	};

	private readonly settingsSelect = {
		theme: true,
		language: true,
		updatedAt: true,
	};

	async getProfile(userId: string) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: this.profileSelect,
		});

		if (!user) throw new AppError("User not found", HttpStatus.NOT_FOUND);

		return user;
	}

	async updateProfile(
		userId: string,
		data: { name?: string; username?: string },
	) {
		if (data.username) {
			const existing = await prisma.user.findFirst({
				where: { username: data.username, NOT: { id: userId } },
				select: { id: true },
			});
			if (existing) throw new AppError("Username already taken", HttpStatus.CONFLICT);
		}

		const updated = await prisma.user.update({
			where: { id: userId },
			data,
			select: this.profileSelect,
		});

		return { message: "Profile updated successfully", data: updated };
	}

	async getSettings(userId: string) {
		return prisma.userSettings.upsert({
			where: { userId },
			create: { userId },
			update: {},
			select: this.settingsSelect,
		});
	}

	async updateSettings(userId: string, data: { theme?: Theme; language?: string }) {
		return prisma.userSettings.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
			select: this.settingsSelect,
		});
	}
}

export const userService = new UserService();
