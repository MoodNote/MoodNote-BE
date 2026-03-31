import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminUserController } from "../../controllers/admin.user.controller";
import { adminValidators } from "../../validators/admin.validator";

const router = Router();

router.get(
	"/",
	validate(adminValidators.listUsers),
	adminUserController.listUsers,
);

router.get(
	"/:id",
	validate(adminValidators.getUserDetail),
	adminUserController.getUserDetail,
);

router.patch(
	"/:id/status",
	validate(adminValidators.updateUserStatus),
	adminUserController.updateUserStatus,
);

export default router;
