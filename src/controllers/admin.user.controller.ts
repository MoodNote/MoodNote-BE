import { Request, Response } from "express";
import { adminUserService } from "../services/admin.user.service";

export const adminUserController = {
	async listUsers(req: Request, res: Response) {
		try {
			const { page, limit, search, isActive } = req.query as Record<
				string,
				string | undefined
			>;

			const result = await adminUserService.listUsers({
				page: page ? parseInt(page, 10) : 1,
				limit: limit ? parseInt(limit, 10) : 20,
				search,
				isActive:
					isActive === "true"
						? true
						: isActive === "false"
							? false
							: undefined,
			});

			res.status(200).json({
				success: true,
				message: "Users retrieved successfully",
				data: result,
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Failed to retrieve users",
			});
		}
	},

	async getUserDetail(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const result = await adminUserService.getUserDetail(id);
			res.status(200).json({
				success: true,
				message: "User detail retrieved successfully",
				data: result,
			});
		} catch (error: any) {
			const status = error.message === "User not found" ? 404 : 400;
			res.status(status).json({
				success: false,
				message: error.message || "Failed to retrieve user",
			});
		}
	},

	async updateUserStatus(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const { isActive } = req.body as { isActive: boolean };
			const result = await adminUserService.updateUserStatus(id, isActive);
			res.status(200).json({
				success: true,
				message: "User status updated successfully",
				data: result,
			});
		} catch (error: any) {
			const status = error.message === "User not found" ? 404 : 400;
			res.status(status).json({
				success: false,
				message: error.message || "Failed to update user status",
			});
		}
	},
};
