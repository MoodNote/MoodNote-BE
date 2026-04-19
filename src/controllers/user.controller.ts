import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const userController = {
	async getProfile(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const profile = await userService.getProfile(userId);
			res.status(HttpStatus.OK).json({ success: true, message: "Profile retrieved successfully", data: profile });
		} catch (error) {
			handleError(error, res, "Failed to retrieve profile");
		}
	},

	async updateProfile(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const result = await userService.updateProfile(userId, req.body);
			res.status(HttpStatus.OK).json({ success: true, message: result.message, data: result.data });
		} catch (error) {
			handleError(error, res, "Failed to update profile");
		}
	},
};
