import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
	maxRetriesPerRequest: 3,
});

redis.on("error", (err) => console.error("[Redis] Connection error:", err.message));
redis.on("connect", () => console.log("[Redis] Connected"));

export { redis };
