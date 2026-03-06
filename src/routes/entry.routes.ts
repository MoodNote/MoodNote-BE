import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { generalRateLimiter } from "../middlewares/rateLimit.middleware";
import { entryController } from "../controllers/entry.controller";
import { entryValidators } from "../validators/entry.validator";

const router = Router();

router.use(generalRateLimiter);
router.use(authenticate);

router.post(
	"/",
	validate(entryValidators.createEntry),
	entryController.createEntry,
);
router.get(
	"/",
	validate(entryValidators.listEntries),
	entryController.listEntries,
);
router.post(
	"/bulk-delete",
	validate(entryValidators.bulkDeleteEntries),
	entryController.bulkDeleteEntries,
);
router.get("/:id", entryController.getEntry);
router.patch(
	"/:id",
	validate(entryValidators.updateEntry),
	entryController.updateEntry,
);
router.delete("/:id", entryController.deleteEntry);

export default router;
