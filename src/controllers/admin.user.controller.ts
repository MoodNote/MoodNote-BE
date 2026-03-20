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
};
