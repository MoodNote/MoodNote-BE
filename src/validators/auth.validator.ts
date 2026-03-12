import { z } from "zod";

// Password validation regex
const passwordRegex =
	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;

// Email validation schema
const emailSchema = z
	.string()
	.email("Invalid email format")
	.toLowerCase()
	.trim();

// Username validation schema
const usernameSchema = z
	.string()
	.min(3, "Username must be at least 3 characters")
	.max(30, "Username must be at most 30 characters")
	.regex(
		/^[a-z0-9_]+$/,
		"Username can only contain lowercase letters, numbers, and underscores",
	)
	.toLowerCase()
	.trim();

// Password validation schema
const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(
		passwordRegex,
		"Password must contain uppercase, lowercase, number, and special character",
	);

export const authValidators = {
	// Register validation
	register: z.object({
		body: z
			.object({
				email: emailSchema,
				username: usernameSchema,
				password: passwordSchema,
				confirmPassword: z.string(),
				name: z
					.string()
					.min(2, "Name must be at least 2 characters")
					.trim(),
			})
			.refine((data) => data.password === data.confirmPassword, {
				message: "Passwords do not match",
				path: ["confirmPassword"],
			}),
	}),

	// Login validation
	login: z.object({
		body: z.object({
			identifier: z
				.string()
				.min(1, "Email or username is required")
				.trim(),
			password: z.string().min(1, "Password is required"),
		}),
	}),

	// Verify email validation
	verifyEmail: z.object({
		body: z.object({
			email: emailSchema,
			otp: z
				.string()
				.length(6, "OTP must be 6 digits")
				.regex(/^\d{6}$/, "OTP must contain only digits"),
		}),
	}),

	// Resend verification OTP validation
	resendVerification: z.object({
		body: z.object({
			email: emailSchema,
		}),
	}),

	// Forgot password validation
	forgotPassword: z.object({
		body: z.object({
			email: emailSchema,
		}),
	}),

	// Resend reset OTP validation
	resendResetOtp: z.object({
		body: z.object({
			email: emailSchema,
		}),
	}),

	// Verify reset OTP validation
	verifyResetOtp: z.object({
		body: z.object({
			email: emailSchema,
			otp: z
				.string()
				.length(6, "OTP must be 6 digits")
				.regex(/^\d{6}$/, "OTP must contain only digits"),
		}),
	}),

	// Reset password validation
	resetPassword: z.object({
		body: z
			.object({
				email: emailSchema,
				password: passwordSchema,
				confirmPassword: z.string(),
			})
			.refine((data) => data.password === data.confirmPassword, {
				message: "Passwords do not match",
				path: ["confirmPassword"],
			}),
	}),

	// Change password validation
	changePassword: z.object({
		body: z
			.object({
				currentPassword: z
					.string()
					.min(1, "Current password is required"),
				newPassword: passwordSchema,
				confirmPassword: z.string(),
			})
			.refine((data) => data.newPassword === data.confirmPassword, {
				message: "Passwords do not match",
				path: ["confirmPassword"],
			})
			.refine((data) => data.currentPassword !== data.newPassword, {
				message: "New password must be different from current password",
				path: ["newPassword"],
			}),
	}),

	// Refresh token validation
	refreshToken: z.object({
		body: z.object({
			refreshToken: z.string().min(1, "Refresh token is required"),
		}),
	}),
};
