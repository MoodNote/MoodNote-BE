import { Router } from "express";
import { authenticateAdmin } from "../middlewares/admin.middleware";
import adminAuthRoutes from "./admin/auth.routes";
import adminNotificationRoutes from "./admin/notification.routes";
import adminUserRoutes from "./admin/user.routes";

const router = Router();

// Public admin routes (no auth required)
router.use("/auth", adminAuthRoutes);

// Protected admin routes (authenticateAdmin required)
const adminProtected = Router();
adminProtected.use(authenticateAdmin);
adminProtected.use("/notifications", adminNotificationRoutes);
adminProtected.use("/users", adminUserRoutes);

router.use(adminProtected);

export default router;
