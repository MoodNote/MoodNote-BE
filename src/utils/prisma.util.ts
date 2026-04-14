import { Prisma } from "@prisma/client";
import { AppError } from "./app-error.util";

/**
 * Translates known Prisma error codes into typed AppErrors.
 * Call inside a catch block; re-throws unknown errors as-is.
 */
export function handlePrismaError(error: unknown): never {
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		if (error.code === "P2002") {
			throw new AppError("Name already exists", 409);
		}
		if (error.code === "P2025") {
			throw new AppError("Record not found", 404);
		}
		if (error.code === "P2003" || error.code === "P2014") {
			throw new AppError(
				"Cannot delete: record is referenced by other data",
				409,
			);
		}
	}
	throw error;
}
