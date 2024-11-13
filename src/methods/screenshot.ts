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

async function screenshotByID(id: number) {
		const web = await WebModel.findByPk(id);

		if (!web) {
			throw new Error("没找到喵~ 你确定你输入的 ID 正确吗？");
		}

	return await screenshotByUrl(web.link);
}

async function screenshotByUrl(url: string) {
	try {
		logger.debug("Launching Browser.", "SCREENSHOT");
		const browser = await launch({
			headless: true,
			args: [
				`--user-data-dir=${path.resolve(tmpPath)}`,
				"--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
				"--disable-logging",
				"--log-level=3",
				"--no-sandbox",
				"--disable-setuid-sandbox",
			],
		});
		logger.debug("Browser Launched.", "SCREENSHOT");
		const page = await browser.newPage();
		logger.debug("Page created.", "SCREENSHOT");
		await page.setViewport({ width: 1920, height: 1080 });
		logger.debug("Page Viewport setted.", "SCREENSHOT");
		await page.setExtraHTTPHeaders({
			referer: "https://www.travellings.cn/go.html", // 来自开往的 Referer
		});
		logger.debug("Page Header setted.", "SCREENSHOT");
		// await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);

		await Promise.all([
			page.goto(url),
			page.waitForNavigation({ waitUntil: "networkidle0" }),
		]);
		logger.debug("Navigation finalized.", "SCREENSHOT");
		const screenshotBuffer = await page.screenshot();

		logger.debug("Screen shotted.", "SCREENSHOT");
		await browser.close();
		logger.debug("Browser Closed.", "SCREENSHOT");
		return screenshotBuffer;
	} catch (e) {
		if ((e as Error)["message"] !== undefined) {
			logger.err((e as Error).message, "SCREENSHOT");
		}
		throw new Error("出错了喵~ 更多信息可能包含在控制台中~");
	}
}

export { screenshotByID, screenshotByUrl };
