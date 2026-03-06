import { Request, Response } from "express";
import { entryService } from "../services/entry.service";

export const entryController = {
	/**
	 * POST /api/entries
	 */
	async createEntry(req: Request, res: Response) {
		try {
			const { title, content, entryDate, inputMethod, tags, isPrivate } =
				req.body;
			const entry = await entryService.createEntry(req.user!.userId, {
				title,
				content,
				entryDate,
				inputMethod,
				tags,
				isPrivate,
			});

			res.status(201).json({
				success: true,
				message: "Entry created successfully",
				data: { entry },
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Failed to create entry",
			});
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
				tags: req.query.tags as string | undefined,
				analysisStatus: req.query.analysisStatus as any,
			});

			res.status(200).json({
				success: true,
				message: "Entries retrieved successfully",
				data: result,
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Failed to retrieve entries",
			});
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

			res.status(200).json({
				success: true,
				message: "Entry retrieved successfully",
				data: { entry },
			});
		} catch (error: any) {
			if (error.message === "Entry not found") {
				return res
					.status(404)
					.json({ success: false, message: error.message });
			}
			if (error.message === "Access denied") {
				return res
					.status(403)
					.json({ success: false, message: error.message });
			}
			res.status(400).json({
				success: false,
				message: error.message || "Failed to retrieve entry",
			});
		}
	},

	/**
	 * PATCH /api/entries/:id
	 */
	async updateEntry(req: Request, res: Response) {
		try {
			const { title, content, tags, isPrivate } = req.body;
			const entry = await entryService.updateEntry(
				req.user!.userId,
				req.params.id,
				{
					title,
					content,
					tags,
					isPrivate,
				},
			);

			res.status(200).json({
				success: true,
				message: "Entry updated successfully",
				data: { entry },
			});
		} catch (error: any) {
			if (error.message === "Entry not found") {
				return res
					.status(404)
					.json({ success: false, message: error.message });
			}
			if (error.message === "Access denied") {
				return res
					.status(403)
					.json({ success: false, message: error.message });
			}
			if (error.message === "No fields to update") {
				return res
					.status(400)
					.json({ success: false, message: error.message });
			}
			res.status(400).json({
				success: false,
				message: error.message || "Failed to update entry",
			});
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
			res.status(200).json({
				success: true,
				message: "Entries deleted successfully",
				data: result,
			});
		} catch (error: any) {
			res.status(400).json({
				success: false,
				message: error.message || "Failed to delete entries",
			});
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

			res.status(200).json({
				success: true,
				message: result.message,
			});
		} catch (error: any) {
			if (error.message === "Entry not found") {
				return res
					.status(404)
					.json({ success: false, message: error.message });
			}
			if (error.message === "Access denied") {
				return res
					.status(403)
					.json({ success: false, message: error.message });
			}
			res.status(400).json({
				success: false,
				message: error.message || "Failed to delete entry",
			});
		}
	},
};
