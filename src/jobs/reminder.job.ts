import cron from "node-cron";
import { notificationService } from "../services/notification.service";

export const startReminderJob = () => {
	let isRunning = false;

	// Run every minute to check reminder schedules
	cron.schedule("* * * * *", async () => {
		if (isRunning) return;
		isRunning = true;
		try {
			await notificationService.processReminders();
		} catch (error: unknown) {
			console.error(
				"[Reminder Job] Error:",
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			isRunning = false;
		}
	});

	console.log("✓ Reminder job started (runs every minute)");
};
