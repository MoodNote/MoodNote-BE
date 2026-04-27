import prisma from "../config/database";

export const adminHealthService = {
	async check() {
		const startTime = Date.now();
		let dbStatus: { status: string; latencyMs?: number; message?: string };

		try {
			await prisma.$queryRaw`SELECT 1`;
			dbStatus = { status: "ok", latencyMs: Date.now() - startTime };
		} catch {
			dbStatus = { status: "error", message: "Cannot reach database" };
		}

		const mem = process.memoryUsage();
		const isHealthy = dbStatus.status === "ok";

		return {
			status: isHealthy ? "ok" : "degraded",
			timestamp: new Date().toISOString(),
			uptime: Math.floor(process.uptime()),
			version: process.env.npm_package_version ?? "1.0.0",
			database: dbStatus,
			memory: {
				heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
				heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(1),
				rssMB: +(mem.rss / 1024 / 1024).toFixed(1),
			},
		};
	},
};
