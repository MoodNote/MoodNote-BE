import { emailTransporter, emailConfig } from "../config/email.config";
import { authConfig } from "../config/auth.config";

export const emailService = {
	/**
	 * Send email verification OTP
	 */
	async sendVerificationEmail(
		email: string,
		name: string,
		otp: string,
	): Promise<void> {
		const mailOptions = {
			from: emailConfig.from,
			to: email,
			subject: "Verify Your Email - MoodNote",
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome to MoodNote, ${name}!</h2>
          <p style="color: #666; line-height: 1.6;">Thank you for registering. Use the OTP below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f0f4ff; border: 2px solid #007bff; padding: 20px 40px; border-radius: 8px; display: inline-block;">
              <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Your verification code</p>
              <h1 style="margin: 0; letter-spacing: 12px; color: #007bff; font-size: 36px; font-weight: bold;">${otp}</h1>
            </div>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">This OTP will expire in 24 hours.</p>
          <p style="color: #999; font-size: 14px;">If you didn't create an account, please ignore this email.</p>
        </div>
      `,
		};

		await emailTransporter.sendMail(mailOptions);
	},

	/**
	 * Send password reset OTP
	 */
	async sendPasswordResetEmail(
		email: string,
		otp: string,
		name: string,
	): Promise<void> {
		const mailOptions = {
			from: emailConfig.from,
			to: email,
			subject: "Password Reset Request - MoodNote",
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
          <p style="color: #666; line-height: 1.6;">We received a request to reset your password. Use the following OTP to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; display: inline-block;">
              <h1 style="margin: 0; letter-spacing: 8px; color: #333;">${otp}</h1>
            </div>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">This OTP will expire in 1 hour.</p>
          <p style="color: #999; font-size: 14px;">If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
      `,
		};

		await emailTransporter.sendMail(mailOptions);
	},

	/**
	 * Send password changed notification
	 */
	async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
		const mailOptions = {
			from: emailConfig.from,
			to: email,
			subject: "Password Changed - MoodNote",
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Changed Successfully</h2>
          <p style="color: #666; line-height: 1.6;">Hi ${name},</p>
          <p style="color: #666; line-height: 1.6;">Your password has been changed successfully.</p>
          <p style="color: #666; line-height: 1.6;">If you did not make this change, please contact our support team immediately.</p>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">For security reasons, all other sessions have been logged out.</p>
        </div>
      `,
		};

		await emailTransporter.sendMail(mailOptions);
	},
};
