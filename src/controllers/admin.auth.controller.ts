import { Request, Response } from "express";
import { adminAuthService } from "../services/admin.auth.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const adminAuthController = {
	async adminLogin(req: Request, res: Response) {
		try {
			const { email, password } = req.body;
			const result = await adminAuthService.adminLogin(email, password);

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Admin login successful",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Admin login failed");
		}
	},

	async adminRefreshToken(req: Request, res: Response) {
		try {
			const { refreshToken } = req.body as { refreshToken: string };
			const result = await adminAuthService.refreshAdminToken(refreshToken);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Token refreshed",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to refresh token");
		}
	},

	async adminLogout(req: Request, res: Response) {
		try {
			const { refreshToken } = req.body as { refreshToken: string };
			await adminAuthService.adminLogout(refreshToken);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Admin logout successful",
			});
		} catch (error) {
			handleError(error, res, "Logout failed");
		}
	},
};
