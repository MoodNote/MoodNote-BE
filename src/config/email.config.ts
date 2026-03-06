import nodemailer from "nodemailer";

export const emailTransporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST,
	port: parseInt(process.env.EMAIL_PORT || "587"),
	secure: process.env.EMAIL_SECURE === "true",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASSWORD,
	},
});

export const emailConfig = {
	from: process.env.EMAIL_FROM || "MoodNote <noreply@moodnote.com>",
};
