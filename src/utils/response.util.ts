import { Response } from "express";
import { AppError } from "./app-error.util";
import { HttpStatus } from "./http-status.util";

/**
 * Unified controller error handler.
 * - AppError: responds with the explicit statusCode and message from the service.
 * - Unexpected errors: responds with 500 — these represent bugs or infrastructure failures.
 */
export function handleError(
	error: unknown,
	res: Response,
	fallback: string,
): void {
	if (error instanceof AppError) {
		res
			.status(error.statusCode)
			.json({ success: false, message: error.message });
		return;
	}
	res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
		success: false,
		message: error instanceof Error ? error.message : fallback,
	});
}
