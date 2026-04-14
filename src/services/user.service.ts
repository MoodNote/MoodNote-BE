import prisma from "../config/database";

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

	async getProfile(userId: string) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: this.profileSelect,
		});

		if (!user) throw new Error("User not found");

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
			if (existing) throw new Error("Username already taken");
		}

		const updated = await prisma.user.update({
			where: { id: userId },
			data,
			select: this.profileSelect,
		});

		return { message: "Profile updated successfully", data: updated };
	}
}

export const userService = new UserService();
