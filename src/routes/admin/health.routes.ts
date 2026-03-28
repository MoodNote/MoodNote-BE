import { Router, Request, Response } from "express";
import prisma from "../../config/database";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
	const startTime = Date.now();
	let dbStatus: { status: string; latencyMs?: number; message?: string };

	try {
		await prisma.$queryRaw`SELECT 1`;
		dbStatus = { status: "ok", latencyMs: Date.now() - startTime };
	} catch (err) {
		dbStatus = { status: "error", message: "Cannot reach database" };
	}

	const mem = process.memoryUsage();
	const isHealthy = dbStatus.status === "ok";

	res.status(200).json({
		success: true,
		message: isHealthy ? "Service is healthy" : "Service is degraded",
		data: {
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
		},
	});
});

export default router;
