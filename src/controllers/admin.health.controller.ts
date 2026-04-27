import { Request, Response } from "express";
import { adminHealthService } from "../services/admin.health.service";
import { HttpStatus } from "../utils/http-status.util";

export const adminHealthController = {
	async check(_req: Request, res: Response) {
		const data = await adminHealthService.check();
		res.status(HttpStatus.OK).json({
			success: true,
			message:
				data.status === "ok"
					? "Service is healthy"
					: "Service is degraded",
			data,
		});
	},
};
