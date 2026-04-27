import { Router } from "express";
import authRoutes from "./auth.routes";
import entryRoutes from "./entry.routes";
import userRoutes from "./user.routes";
import notificationRoutes from "./notification.routes";
import adminRoutes from "./admin.routes";
import musicRoutes from "./music.routes";
import statsRoutes from "./stats.routes";
import moodTagsRoutes from "./mood-tags.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/entries", entryRoutes);
router.use("/users", userRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);
router.use("/music", musicRoutes);
router.use("/stats", statsRoutes);
router.use("/mood-tags", moodTagsRoutes);

export default router;
