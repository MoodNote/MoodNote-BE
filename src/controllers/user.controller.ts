import { Request, Response } from "express";
import { userService } from "../services/user.service";

export const userController = {
	async getProfile(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const profile = await userService.getProfile(userId);
			res.status(200).json({ success: true, message: "Profile retrieved successfully", data: profile });
		} catch (error) {
			res
				.status(404)
				.json({ success: false, message: (error as Error).message });
		}
	},

	async updateProfile(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const result = await userService.updateProfile(userId, req.body);
			res
				.status(200)
				.json({ success: true, message: result.message, data: result.data });
		} catch (error) {
			const message = (error as Error).message;
			const status = message === "Username already taken" ? 409 : 400;
			res.status(status).json({ success: false, message });
		}
	},
};
