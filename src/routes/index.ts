import { Router } from "express";
import authRoutes from "./auth.routes";
import entryRoutes from "./entry.routes";
import userRoutes from "./user.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/entries", entryRoutes);
router.use("/users", userRoutes);

export default router;
