// 别动这个
import { execSync } from "child_process";
import { config as dotenv_config } from "dotenv";
import path from "path";

if (!process.env["LOADED_CONFIG"]) {
	dotenv_config(); // 加载 .env 文件中的环境变量
	process.env["LOADED_CONFIG"] = "true"; // 标记 dotenv 已加载
}

export const config = {
	// Github Auth
	// GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || './data/privateKey.pem',

	// BOT_ID
	BOT_ID:
		process.env["BOT_ID"] ||
		(() => {
			const chars =
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
			let uuid = "";
			for (let i = 0; i < 8; i++) {
				uuid += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return uuid;
		})(),

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
	TG_BOT_API: process.env["TG_BOT_API"] || "https://botapi.xcnya.cn",
	TG_BOT_CHATID: process.env["TG_BOT_CHATID"]
		? parseInt(process.env["TG_BOT_CHATID"])
		: 5502448506,
	TG_BOT_TOKEN: process.env["TG_BOT_TOKEN"] || "",
	TG_ALLOW_CHATID: process.env["TG_ALLOW_CHATID"]
		? process.env["TG_ALLOW_CHATID"].split(",").map((id) => parseInt(id))
		: [5502448506],

	// Lark Bot
	LARK_BOT_APPID: process.env["LARK_BOT_APPID"] || "",
	LARK_BOT_SECRET: process.env["LARK_BOT_SECRET"] || "",
	LARK_CHATID: process.env["LARK_CHATID"]
		? process.env["LARK_CHATID"].split(",")
		: ["oc_bcc115f23153490d907d7f6793e6fdc0"],

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

	// Max Concurrent
	AXIOS_CHECK_MAX_CONCURRENT: process.env["AXIOS_CHECK_MAX_CONCURRENT"]
		? parseInt(process.env["AXIOS_CHECK_MAX_CONCURRENT"])
		: 20,
	BROWSER_CHECK_MAX_CONCURRENT: process.env["BROWSER_CHECK_MAX_CONCURRENT"]
		? parseInt(process.env["BROWSER_CHECK_MAX_CONCURRENT"])
		: 1,

	// Min run sites percentage
	MIN_RUN_SITES_PERCENTAGE: process.env["MIN_RUN_SITES_PERCENTAGE"]
		? parseFloat(process.env["MIN_RUN_SITES_PERCENTAGE"])
		: 50,

	// COMMIT_HASH
	COMMIT_HASH: (() => {
		try {
			return execSync("git rev-parse HEAD").toString().trim();
		} catch (error) {
			return `获取失败 ${(error as Error).message}`;
		}
	})(),

	// ENABLE
	SCHEDULE_TASK_ENABLE: false,
	COMMAND_ENABLE: true,
};
