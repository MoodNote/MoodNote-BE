import { Request, Response } from "express";
import { entryService } from "../services/entry.service";
import { handleError } from "../utils/response.util";
import { HttpStatus } from "../utils/http-status.util";

export const entryController = {
	/**
	 * POST /api/entries
	 */
	async createEntry(req: Request, res: Response) {
		try {
			const { title, content, entryDate, inputMethod, tagIds, isPrivate } =
				req.body;
			const entry = await entryService.createEntry(req.user!.userId, {
				title,
				content,
				entryDate,
				inputMethod,
				tagIds,
				isPrivate,
			});

			res.status(HttpStatus.CREATED).json({
				success: true,
				message: "Entry created successfully",
				data: { entry },
			});
		} catch (error) {
			handleError(error, res, "Failed to create entry");
		}
	},

	/**
	 * GET /api/entries
	 */
	async listEntries(req: Request, res: Response) {
		try {
			const result = await entryService.listEntries(req.user!.userId, {
				page: req.query.page
					? parseInt(req.query.page as string, 10)
					: 1,
				limit: req.query.limit
					? parseInt(req.query.limit as string, 10)
					: 20,
				startDate: req.query.startDate as string | undefined,
				endDate: req.query.endDate as string | undefined,
				tagIds: req.query.tagIds as string | undefined,
				analysisStatus: req.query.analysisStatus as
					| "PENDING"
					| "PROCESSING"
					| "COMPLETED"
					| "FAILED"
					| undefined,
			});

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Entries retrieved successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve entries");
		}
	},

	/**
	 * GET /api/entries/:id
	 */
	async getEntry(req: Request, res: Response) {
		try {
			const entry = await entryService.getEntry(
				req.user!.userId,
				req.params.id,
			);

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Entry retrieved successfully",
				data: { entry },
			});
		} catch (error) {
			handleError(error, res, "Failed to retrieve entry");
		}
	},

	/**
	 * PATCH /api/entries/:id
	 */
	async updateEntry(req: Request, res: Response) {
		try {
			const { title, content, tagIds, isPrivate } = req.body;
			const entry = await entryService.updateEntry(
				req.user!.userId,
				req.params.id,
				{
					title,
					content,
					tagIds,
					isPrivate,
				},
			);

			res.status(HttpStatus.OK).json({
				success: true,
				message: "Entry updated successfully",
				data: { entry },
			});
		} catch (error) {
			handleError(error, res, "Failed to update entry");
		}
	},

	/**
	 * POST /api/entries/bulk-delete
	 */
	async bulkDeleteEntries(req: Request, res: Response) {
		try {
			const { ids } = req.body;
			const result = await entryService.bulkDeleteEntries(
				req.user!.userId,
				ids,
			);
			res.status(HttpStatus.OK).json({
				success: true,
				message: "Entries deleted successfully",
				data: result,
			});
		} catch (error) {
			handleError(error, res, "Failed to delete entries");
		}
	},

	/**
	 * DELETE /api/entries/:id
	 */
	async deleteEntry(req: Request, res: Response) {
		try {
			const result = await entryService.deleteEntry(
				req.user!.userId,
				req.params.id,
			);

			res.status(HttpStatus.OK).json({
				success: true,
				message: result.message,
			});
		} catch (error) {
			handleError(error, res, "Failed to delete entry");
		}
	},
};
