import cron from "node-cron";
import { notificationService } from "../services/notification.service";

export const startReminderJob = () => {
	// Run every minute to check reminder schedules
	cron.schedule("* * * * *", async () => {
		try {
			await notificationService.processReminders();
		} catch (error: any) {
			console.error("[Reminder Job] Error:", error.message);
		}
	});

	console.log("✓ Reminder job started (runs every minute)");
};
