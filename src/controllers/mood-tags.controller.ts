import { Request, Response } from "express";
import { moodTagsService } from "../services/mood-tags.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const moodTagsController = {
	async listTags(req: Request, res: Response) {
		try {
			const result = await moodTagsService.listTags();
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Mood tags retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve mood tags");
		}
	},
};
