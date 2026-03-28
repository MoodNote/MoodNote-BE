import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { generalRateLimiter } from "./middlewares/rateLimit.middleware";

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all routes
app.use(generalRateLimiter);

// Routes
app.get("/", (_req: Request, res: Response) => {
	res.json({ message: "Welcome to MoodNote API" });
});

// API routes
app.use("/api", routes);

// 404 handler
app.use((_req: Request, res: Response) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
	});
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
	console.error("Error:", err);
	res.status(err.status || 500).json({
		success: false,
		message: err.message || "Internal server error",
	});
});

export default app;
