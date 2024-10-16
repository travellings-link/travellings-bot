//   ____ _                                 ____      _
//  / ___| |__  _ __ ___  _ __ ___   ___   / ___| ___| |_
// | |   | '_ \| '__/ _ \| '_ ` _ \ / _ \ | |  _ / _ \ __|
// | |___| | | | | | (_) | | | | | |  __/ | |_| |  __/ |_
//  \____|_| |_|_|  \___/|_| |_| |_|\___|  \____|\___|\__|
//
// Chrome Webdriver Check Websites util
// By <huixcwg@gmail.com>
// 2024/01/16 13:39 CST

// Migrated to ESM & Typescript on 2024/10/10 by Allenyou <i@allenyou.wang>

import fs from "fs";
import path from "path";
import axios from "axios";
import { Op } from "sequelize";
import { config } from "../config";
import { launch, Page } from "puppeteer";
import { Logger, logger, time } from "../modules/typedLogger";
import { WebModel } from "../modules/sqlModel";

import { botManager } from "bot/botManager";

let total = 0,
	run = 0,
	lost = 0,
	errorCount = 0,
	timeout = 0,
	fourxx = 0,
	fivexx = 0;
// 如果不存在 tmp 就创建一个
const tmpPath = config.TMP_PATH;
if (!fs.existsSync(tmpPath)) {
	fs.mkdirSync(tmpPath);
}

function spentTime(input: number) {
	const hours = Math.floor(input / 3600);
	const minutes = Math.floor((input % 3600) / 60);
	const seconds = Math.floor(input % 60);
	return `${hours}小时 ${minutes}分 ${seconds}秒`;
}

export default async function browserCheck(input?: number) {
	total = 0;
	run = 0;
	lost = 0;
	errorCount = 0;
	timeout = 0;
	fourxx = 0;
	fivexx = 0;
	const browser = await launch({
		headless: true,
		args: [
			"--disable-features=StylesWithCss=false",
			"--blink-settings=imagesEnabled=false",
			`--user-data-dir=${path.resolve(tmpPath)}`,
			"--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
			"--disable-logging",
			"--log-level=3",
			"--no-sandbox",
		],
	});
	const page = await browser.newPage();
	await page.setViewport({ width: 1920, height: 1080 });
	// await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);
	await page.setExtraHTTPHeaders({
		referer: "https://www.travellings.cn/go.html", // 来自开往的 Referer
	});
	const startTime = new Date();
	const browser_logger = new Logger("_Browser");

	try {
		if (!input) {
			// 没传参不动
			const sitesToCheck = await WebModel.findAll({
				where: {
					status: {
						[Op.in]: ["LOST", "ERROR", "403"],
					},
				},
			});

			for (const site of sitesToCheck) {
				await check(page, site, browser_logger);
				total++;
			}
		} else {
			const site = await WebModel.findOne({
				where: {
					id: input,
				},
			});

			if (site) {
				await check(page, site, browser_logger);
				total++;
			} else {
				browser_logger.err("指定的 ID 不存在", "BROWSER");
				return;
			}
		}
	} catch (error) {
		browser_logger.err(`发生错误：${error}`, "BROWSER");
	} finally {
		await browser.close();
		const endTime = new Date();
		const input = (endTime.getTime() - startTime.getTime()) / 1000;
		// 清除 Redis 缓存
		try {
			await axios.get(`${config.API_URL}/all`);
			await axios.delete(`${config.API_URL}/action/purgeCache`, {
				headers: { Cookie: `_tlogin=${config.API_TOKEN}` },
			});
		} catch (e) {
			logger.err((e as Error).message, "REDIS");
		}

		const stats = `检测耗时：${spentTime(
			input
		)}｜总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个`;
		browser_logger.info(`检测完成 >> ${stats}`, "BROWSER");
		botManager.boardcastMessage(
			`<strong>开往巡查姬提醒您：</strong>\n\n本次巡查方式：Browser\n持续了 ${spentTime(
				input
			)}\n\n<strong>巡查报告</strong>\n总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个\n\n发送时间：${time()} CST\n备注：仅巡查 LOST 和 ERROR 状态的站点`
		);
	}
}

async function check(page: Page, site: WebModel, log: Logger) {
	try {
		await page.goto(site.link);
		await page.waitForNavigation({ waitUntil: "networkidle0" });

		if (parseInt(site.status) >= 500) {
			log.info(`ID >> ${site.id}, Result >> 不做修改`, "BROWSER");
			fourxx++;
		} else {
			const pageContent = await page.content();
			const includeEN = pageContent.includes("travelling");
			const includeZH = pageContent.includes("开往");

			if (includeEN || includeZH) {
				await WebModel.update(
					{ status: "RUN", failedReason: null },
					{ where: { id: site.id } }
				);
				log.info(`ID >> ${site.id}, Result >> ${site.status} → RUN`, "BROWSER");
				run++;
			} else {
				await WebModel.update(
					{ status: "LOST", failedReason: null },
					{ where: { id: site.id } }
				);
				log.info(
					`ID >> ${site.id}, Result >> ${site.status} → LOST`,
					"BROWSER"
				);
				lost++;
			}
		}
	} catch (error) {
		log.info(
			`ID >> ${site.id}, Result >> ${site.status} → 不做修改, Reason >> ${
				(error as Error).message
			}`,
			"BROWSER"
		);
		errorCount++;
	}
}
