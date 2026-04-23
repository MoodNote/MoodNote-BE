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

	async getSettings(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const settings = await userService.getSettings(userId);
			res.status(HttpStatus.OK).json({ success: true, message: "Settings retrieved successfully", data: { settings } });
		} catch (error) {
			handleError(error, res, "Failed to retrieve settings");
		}
	},

	async updateSettings(req: Request, res: Response) {
		try {
			const userId = req.user!.userId;
			const settings = await userService.updateSettings(userId, req.body);
			res.status(HttpStatus.OK).json({ success: true, message: "Settings updated successfully", data: { settings } });
		} catch (error) {
			handleError(error, res, "Failed to update settings");
		}
	},
};
