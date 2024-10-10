import { createClient } from "redis";
import { config } from "../config";

export const redisClient = createClient({
	url: `redis://${config.REDIS_HOST}:${config.REDIS_PORT}`,
});
