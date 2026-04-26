import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminMoodTagsController } from "../../controllers/admin.mood-tags.controller";
import { adminMoodTagsValidators } from "../../validators/admin.mood-tags.validator";

const router = Router();

router.post("/", validate(adminMoodTagsValidators.createTag), adminMoodTagsController.createTag);
router.get("/", validate(adminMoodTagsValidators.listTags), adminMoodTagsController.listTags);
router.get("/:id", validate(adminMoodTagsValidators.byId), adminMoodTagsController.getTag);
router.patch("/:id", validate(adminMoodTagsValidators.updateTag), adminMoodTagsController.updateTag);
router.delete("/:id", validate(adminMoodTagsValidators.byId), adminMoodTagsController.deleteTag);

export default router;
