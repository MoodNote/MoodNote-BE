import { Request, Response } from "express";
import { authService } from "../services/auth.service";

const errMsg = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export const authController = {
	/**
	 * POST /api/auth/register
	 */
	async register(req: Request, res: Response) {
		try {
			const { email, username, password, name } = req.body;
			const result = await authService.register({
				email,
				username,
				password,
				name,
			});

			res.status(201).json({
				success: true,
				message: result.message,
				data: { user: result.user },
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "Registration failed"),
			});
		}
	},

	/**
	 * POST /api/auth/verify-email
	 */
	async verifyEmail(req: Request, res: Response) {
		try {
			const { email, otp } = req.body;
			const result = await authService.verifyEmail(email, otp);

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "Email verification failed"),
			});
		}
	},

	/**
	 * POST /api/auth/resend-verification
	 */
	async resendVerificationOtp(req: Request, res: Response) {
		try {
			const { email } = req.body;
			const result = await authService.resendVerificationOtp(email);

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "Failed to resend verification OTP"),
			});
		}
	},

	/**
	 * POST /api/auth/login
	 */
	async login(req: Request, res: Response) {
		try {
			const { identifier, password } = req.body;
			const result = await authService.login(identifier, password);

			res.status(200).json({
				success: true,
				message: "Login successful",
				data: result,
			});
		} catch (error) {
			res.status(401).json({
				success: false,
				message: errMsg(error, "Login failed"),
			});
		}
	},

	/**
	 * POST /api/auth/refresh
	 */
	async refreshToken(req: Request, res: Response) {
		try {
			const { refreshToken } = req.body;
			const result = await authService.refreshAccessToken(refreshToken);

			res.status(200).json({
				success: true,
				message: "Token refreshed successfully",
				data: result,
			});
		} catch (error) {
			res.status(401).json({
				success: false,
				message: errMsg(error, "Token refresh failed"),
			});
		}
	},

	/**
	 * POST /api/auth/forgot-password
	 */
	async forgotPassword(req: Request, res: Response) {
		try {
			const { email } = req.body;
			await authService.forgotPassword(email);
		} catch {
			// Intentionally swallowed — always return 200 to prevent user enumeration
		} finally {
			res.status(200).json({
				success: true,
				message:
					"If an account exists with this email, a password reset link has been sent.",
			});
		}
	},

	/**
	 * POST /api/auth/resend-reset-otp
	 */
	async resendResetOtp(req: Request, res: Response) {
		try {
			const { email } = req.body;
			await authService.resendResetOtp(email);
		} catch {
			// Intentionally swallowed — always return 200 to prevent user enumeration
		} finally {
			res.status(200).json({
				success: true,
				message:
					"If an account exists with this email, a new OTP has been sent.",
			});
		}
	},

	/**
	 * POST /api/auth/verify-reset-otp
	 */
	async verifyResetOtp(req: Request, res: Response) {
		try {
			const { email, otp } = req.body;
			const result = await authService.verifyResetOtp(email, otp);

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "OTP verification failed"),
			});
		}
	},

	/**
	 * POST /api/auth/reset-password
	 */
	async resetPassword(req: Request, res: Response) {
		try {
			const { email, password } = req.body;
			const result = await authService.resetPassword(email, password);

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "Password reset failed"),
			});
		}
	},

	/**
	 * POST /api/auth/change-password
	 */
	async changePassword(req: Request, res: Response) {
		try {
			const { currentPassword, newPassword } = req.body;
			const userId = req.user!.userId;

			const result = await authService.changePassword(
				userId,
				currentPassword,
				newPassword,
			);

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "Password change failed"),
			});
		}
	},

	/**
	 * POST /api/auth/logout
	 */
	async logout(req: Request, res: Response) {
		try {
			const { refreshToken, deviceToken } = req.body;
			const result = await authService.logout(refreshToken, deviceToken);

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: errMsg(error, "Logout failed"),
			});
		}
	},
};
