import "dotenv/config";
import app from "./app";
import prisma from "./config/database";
import { startReminderJob } from "./jobs/reminder.job";

const PORT = process.env.PORT || 3000;

async function startServer() {
	try {
		// Test database connection
		await prisma.$connect();
		console.log("✓ Database connected");

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
