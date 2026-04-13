import "dotenv/config";
import app from "./app";
import prisma from "./config/database";
import { startReminderJob } from "./jobs/reminder.job";
import { analysisService } from "./services/analysis.service";

const PORT = process.env.PORT || 3000;

async function startServer() {
	try {
		// Test database connection
		await prisma.$connect();
		console.log("✓ Database connected");

		// Reset any entries stuck in PROCESSING from a previous crash, then
		// queue all PENDING entries so no analysis is silently lost on restart
		await analysisService.recoverOnStartup();

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
			console.log(
				`Environment: ${process.env.NODE_ENV || "development"}`,
			);
			startReminderJob();
		});
	} catch (error) {
		console.error("Failed to connect to database:", error);
		process.exit(1);
	}
}

// Graceful shutdown
process.on("SIGTERM", async () => {
	await prisma.$disconnect();
	process.exit(0);
});

startServer();
