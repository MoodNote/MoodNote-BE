import { Request, Response } from "express";
import { adminMoodTagsService } from "../services/admin.mood-tags.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const adminMoodTagsController = {
	async createTag(req: Request, res: Response) {
		try {
			const tag = await adminMoodTagsService.createTag(req.body);
			res.status(HttpStatus.CREATED).json({
				success: true,
				message: "Mood tag created successfully",
				data: { tag },
			});
		} catch (error) {
			handleError(error, res, "Failed to create mood tag");
		}
	},

	async listTags(req: Request, res: Response) {
		try {
			const { page, limit, search, type } = req.query as Record<string, string | undefined>;
			const result = await adminMoodTagsService.listTags({
				page: page ? parseInt(page, 10) : 1,
				limit: limit ? parseInt(limit, 10) : 20,
				search,
				type: type as "MOOD" | "LIFE" | undefined,
			});
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Mood tags retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve mood tags");
		}
	},

	async getTag(req: Request, res: Response) {
		try {
			const tag = await adminMoodTagsService.getTag(req.params.id);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Mood tag retrieved successfully",
				data: { tag },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve mood tag");
		}
	},

	async updateTag(req: Request, res: Response) {
		try {
			const tag = await adminMoodTagsService.updateTag(req.params.id, req.body);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Mood tag updated successfully",
				data: { tag },
			});
		} catch (error) {
			handleError(error, res, "Failed to update mood tag");
		}
	},

	async deleteTag(req: Request, res: Response) {
		try {
			await adminMoodTagsService.deleteTag(req.params.id);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Mood tag deleted successfully",
			});
		} catch (error) {
			handleError(error, res, "Failed to delete mood tag");
		}
	},
};
