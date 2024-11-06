// const { Op } = require('sequelize');
import fs from "fs";
import path from "path";
import { launch } from "puppeteer";
import { logger } from "../modules/typedLogger";
import { WebModel } from "../modules/sqlModel";
import { config } from "../config";

// 如果不存在 tmp 就创建一个
const tmpPath = config.TMP_PATH;
if (!fs.existsSync(tmpPath)) {
	fs.mkdirSync(tmpPath);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshotByID(id: number) {
	try {
		const web = await WebModel.findByPk(id);

		if (!web) {
			throw new Error("没找到喵~ 你确定你输入的 ID 正确吗？");
		}

		const browser = await launch({
			headless: true,
			args: [
				`--user-data-dir=${path.resolve(tmpPath)}`,
				"--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
				"--disable-logging",
				"--log-level=3",
				"--no-sandbox",
			],
		});

		const page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });
		await page.setExtraHTTPHeaders({
			referer: "https://www.travellings.cn/go.html", // 来自开往的 Referer
		});
		// await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);

		await page.goto(web.link);
		await sleep(4500);
		const screenshotBuffer = await page.screenshot();

		await browser.close();
		return screenshotBuffer;
	} catch (e) {
		if ((e as Error)["message"] !== undefined) {
			logger.err((e as Error).message, "SCREENSHOT");
		}
		throw new Error("出错了喵~ 更多信息可能包含在控制台中~");
	}
}

async function screenshotByUrl(url: string) {
	try {
		const browser = await launch({
			headless: true,
			args: [
				`--user-data-dir=${path.resolve(tmpPath)}`,
				"--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
				"--disable-logging",
				"--log-level=3",
				"--no-sandbox",
			],
		});

		const page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });
		await page.setExtraHTTPHeaders({
			referer: "https://www.travellings.cn/go.html", // 来自开往的 Referer
		});
		// await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);

		await page.goto(url);
		await page.waitForNavigation({ waitUntil: "networkidle0" });
		const screenshotBuffer = await page.screenshot();

		await browser.close();
		return screenshotBuffer;
	} catch (e) {
		if ((e as Error)["message"] !== undefined) {
			logger.err((e as Error).message, "SCREENSHOT");
		}
		throw new Error("出错了喵~ 更多信息可能包含在控制台中~");
	}
}

export { screenshotByID, screenshotByUrl };
