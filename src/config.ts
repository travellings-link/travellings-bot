// 别动这个

import { config as dotenv_config } from "dotenv";
import path from "path";

if (!process.env["LOADED_CONFIG"]) {
	dotenv_config(); // 加载 .env 文件中的环境变量
	process.env["LOADED_CONFIG"] = "true"; // 标记 dotenv 已加载
}

export const config = {
	// Github Auth
	// GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || './data/privateKey.pem',

	// Temp
	TMP_PATH: process.env["TMP_PATH"] || path.join(process.cwd(), "tmp"),

	// Log
	LOG_ENABLE: process.env["LOG_ENABLE"] === "true",
	LOG_PATH: process.env["LOG_PATH"] || path.join(process.cwd(), "logs"),
	LOG_LEVEL: process.env["LOG_LEVEL"] || undefined,

	// Axios
	LOAD_TIMEOUT: process.env["LOAD_TIMEOUT"]
		? parseInt(process.env["LOAD_TIMEOUT"])
		: 15,

	// TG Bot
	BOT_API: process.env["BOT_API"] || "https://botapi.xcnya.cn",
	BOT_CHATID: process.env["BOT_CHATID"]
		? parseInt(process.env["BOT_CHATID"])
		: 5502448506,
	BOT_TOKEN: process.env["BOT_TOKEN"] || "",
	ALLOW_CHATID: process.env["ALLOW_CHATID"]
		? process.env["ALLOW_CHATID"].split(",").map((id) => parseInt(id))
		: [5502448506],

	// Redis
	REDIS_HOST: process.env["REDIS_HOST"] || "127.0.0.1",
	REDIS_PORT: process.env["REDIS_PORT"]
		? parseInt(process.env["REDIS_PORT"])
		: 6379,

	// API
	API_URL: process.env["API_URL"] || "https://api.travellings.cn",
	API_TOKEN: process.env["API_TOKEN"] || "114514",

	// Database
	DB_HOST: process.env["DB_HOST"] || "127.0.0.1",
	DB_NAME: process.env["DB_NAME"] || "travelling_telegram_bot",
	DB_USER: process.env["DB_USER"] || "root",
	DB_PASSWORD: process.env["DB_PASSWORD"] || "",
	DB_PORT: process.env["DB_PORT"] ? parseInt(process.env["DB_PORT"]) : 3306,
};
