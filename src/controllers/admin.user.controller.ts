import { Request, Response } from "express";
import { adminUserService } from "../services/admin.user.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

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

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Users retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve users");
		}
	},

	async getUserDetail(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const result = await adminUserService.getUserDetail(id);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "User detail retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve user");
		}
	},

	async updateUserStatus(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const { isActive } = req.body as { isActive: boolean };
			const result = await adminUserService.updateUserStatus(id, isActive);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "User status updated successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to update user status");
		}
	},
};
