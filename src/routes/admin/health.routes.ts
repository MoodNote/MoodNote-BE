import { Router } from "express";
import { adminHealthController } from "../../controllers/admin.health.controller";

const router = Router();

router.get("/", adminHealthController.check);

export default router;
