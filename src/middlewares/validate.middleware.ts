import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { HttpStatus } from "../utils/http-status.util";

export const validate = (schema: ZodType<any>) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const parsed = await schema.parseAsync({
				body: req.body,
				query: req.query,
				params: req.params,
			});
			if (parsed.body !== undefined) req.body = parsed.body;
			if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
			if (parsed.params !== undefined) req.params = parsed.params;
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				const errors = error.issues.map((err) => ({
					field: err.path.join("."),
					message: err.message,
				}));
				return res.status(HttpStatus.BAD_REQUEST).json({
					success: false,
					message: "Validation failed",
					errors,
				});
			}
			next(error);
		}
	};
};
