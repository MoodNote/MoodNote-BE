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
};
