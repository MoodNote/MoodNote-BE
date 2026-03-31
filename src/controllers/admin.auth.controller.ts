import { Request, Response } from "express";
import { adminAuthService } from "../services/admin.auth.service";

export const adminAuthController = {
	async adminLogin(req: Request, res: Response) {
		try {
			const { email, password } = req.body;
			const result = await adminAuthService.adminLogin(email, password);

			res.status(200).json({
				success: true,
				message: "Admin login successful",
				data: result,
			});
		} catch (error: any) {
			const status =
				error.message === "Forbidden: Admin access required" ? 403 : 401;
			res.status(status).json({
				success: false,
				message: error.message || "Admin login failed",
			});
		}
	},

	async adminRefreshToken(req: Request, res: Response) {
		try {
			const { refreshToken } = req.body as { refreshToken: string };
			const result = await adminAuthService.refreshAdminToken(refreshToken);
			res.status(200).json({
				success: true,
				message: "Token refreshed",
				data: result,
			});
		} catch (error: any) {
			res.status(401).json({
				success: false,
				message: error.message || "Failed to refresh token",
			});
		}
	},

	async adminLogout(req: Request, res: Response) {
		try {
			const { refreshToken } = req.body as { refreshToken: string };
			await adminAuthService.adminLogout(refreshToken);
			res.status(200).json({
				success: true,
				message: "Admin logout successful",
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Logout failed",
			});
		}
	},
};
