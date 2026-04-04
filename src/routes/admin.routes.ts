import { Router } from "express";
import { authenticateAdmin } from "../middlewares/admin.middleware";
import adminAuthRoutes from "./admin/auth.routes";
import adminNotificationRoutes from "./admin/notification.routes";
import adminUserRoutes from "./admin/user.routes";
import adminMusicRoutes from "./admin/music.routes";
import adminHealthRoutes from "./admin/health.routes";
import adminAiRoutes from "./admin/ai.routes";

const router = Router();

// Public admin routes (no auth required)
router.use("/auth", adminAuthRoutes);

// Protected admin routes (authenticateAdmin required)
const adminProtected = Router();
adminProtected.use(authenticateAdmin);
adminProtected.use("/health", adminHealthRoutes);
adminProtected.use("/notifications", adminNotificationRoutes);
adminProtected.use("/users", adminUserRoutes);
adminProtected.use("/music", adminMusicRoutes);
adminProtected.use("/ai", adminAiRoutes);

router.use(adminProtected);

export default router;
