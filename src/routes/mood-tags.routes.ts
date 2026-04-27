import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { generalRateLimiter } from "../middlewares/rateLimit.middleware";
import { moodTagsController } from "../controllers/mood-tags.controller";

const router = Router();

router.get("/", generalRateLimiter, authenticate, moodTagsController.listTags);

export default router;
