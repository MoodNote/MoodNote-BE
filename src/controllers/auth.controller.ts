import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

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

			res.status(HttpStatus.CREATED).json({
				success: true,
				message: result.message,
				data: { user: result.user },
			});
		} catch (error) {
			handleError(error, res, "Registration failed");
		}
	},

	/**
	 * POST /api/auth/verify-email
	 */
	async verifyEmail(req: Request, res: Response) {
		try {
			const { email, otp } = req.body;
			const result = await authService.verifyEmail(email, otp);

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "Email verification failed");
		}
	},

	/**
	 * POST /api/auth/resend-verification
	 */
	async resendVerificationOtp(req: Request, res: Response) {
		try {
			const { email } = req.body;
			const result = await authService.resendVerificationOtp(email);

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "Failed to resend verification OTP");
		}
	},

	/**
	 * POST /api/auth/login
	 */
	async login(req: Request, res: Response) {
		try {
			const { identifier, password } = req.body;
			const result = await authService.login(identifier, password);

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Login successful",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Login failed");
		}
	},

	/**
	 * POST /api/auth/refresh
	 */
	async refreshToken(req: Request, res: Response) {
		try {
			const { refreshToken } = req.body;
			const result = await authService.refreshAccessToken(refreshToken);

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Token refreshed successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Token refresh failed");
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
			res.status(HttpStatus.OK).json({
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
			res.status(HttpStatus.OK).json({
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

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "OTP verification failed");
		}
	},

	/**
	 * POST /api/auth/reset-password
	 */
	async resetPassword(req: Request, res: Response) {
		try {
			const { email, password } = req.body;
			const result = await authService.resetPassword(email, password);

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "Password reset failed");
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

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "Password change failed");
		}
	},

	/**
	 * POST /api/auth/logout
	 */
	async logout(req: Request, res: Response) {
		try {
			const { refreshToken, deviceToken } = req.body;
			const result = await authService.logout(refreshToken, deviceToken);

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "Logout failed");
		}
	},
};
