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

import { botManager } from "../bot/botManager";

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
					lastManualCheck: {
						[Op.or]: [
							{ [Op.eq]: null },
							{
								[Op.lt]: new Date(
									new Date().getTime() - 30 * 24 * 60 * 60 * 1000
								),
							},
						],
					},
				},
			});

			// 在飞书表格中把之前的数据标为过期
			if (config.LARK_DELETE_TOKEN !== undefined) {
				await axios.post(
					"https://travellings.feishu.cn/base/automation/webhook/event/IMGSaw0NYwvpgvh62p6cSxeVnXM",
					{},
					{
						headers: {
							Authorization: `Bearer ${config.LARK_DELETE_TOKEN}`,
						},
					}
				);
			}

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
		botManager.boardcastRichTextMessage([
			[{ type: "text", bold: true, content: "开往巡查姬提醒您：" }],
			[{ type: "text", content: "" }],
			[{ type: "text", content: "本次巡查方式：Browser" }],
			[{ type: "text", content: `持续了 ${spentTime(input)}` }],
			[{ type: "text", content: "" }],
			[{ type: "text", bold: true, content: "巡查报告" }],
			[
				{
					type: "text",
					content: `总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个`,
				},
			],
			[{ type: "text", content: "" }],
			[{ type: "text", content: `发送时间：${time()} CST` }],
			[
				{
					type: "text",
					bold: true,
					content: "备注：仅巡查 LOST 和 ERROR 状态的站点",
				},
			],
		]);
		// botManager.boardcastMessage(
		// 	`<strong>开往巡查姬提醒您：</strong>\n\n本次巡查方式：Browser\n持续了 ${spentTime(
		// 		input
		// 	)}\n\n<strong>巡查报告</strong>\n总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个\n\n发送时间：${time()} CST\n备注：仅巡查 LOST 和 ERROR 状态的站点`
		// );
	}
}

async function pushToLark(site: WebModel) {
	if (config.LARK_ADD_TOKEN === undefined) {
		return;
	}
	axios.post(
		"https://travellings.feishu.cn/base/automation/webhook/event/XqqeajshBwBIRlh4GyAcu1d1ned",
		{
			site_id: site.id,
			link: site.link,
		},
		{
			headers: {
				Authorization: `Bearer ${config.LARK_ADD_TOKEN}`,
			},
		}
	);
}

async function check(page: Page, site: WebModel, log: Logger) {
	try {
		await Promise.all([
			page.goto(site.link),
			page.waitForNavigation({ waitUntil: "networkidle0" }),
		]);

		if (parseInt(site.status) >= 500) {
			log.info(`ID >> ${site.id}, Result >> 不做修改`, "BROWSER");
			fourxx++;
		} else {
			const pageContent = await page.content();

			// 可能的绕过方法 -> 站点挂个无实际跳转作用的文字
			const includeEN = pageContent.includes("travelling");
			const includeZH = pageContent.includes("开往");
			
			// 可能的绕过方法 -> 站点挂个假链接但是无实际跳转作用/挂个不可见的链接
			// 许可的开往跳转外链
			const links = [
				"https://www.travellings.cn/go.html",
				"https://www.travellings.cn/plain.html",
				"https://www.travellings.cn/coder-1024.html",
				"https://www.travellings.cn/go-by-clouds.html",
			];
			const includeLink = links.some(link => pageContent.includes(link));

			if (includeEN || includeZH || includeLink) {
				await WebModel.update(
					{ status: "RUN", failedReason: null, lastManualCheck: null },
					{ where: { id: site.id } }
				);
				log.info(`ID >> ${site.id}, Result >> ${site.status} → RUN`, "BROWSER");
				run++;
			} else {
				await pushToLark(site);
				await WebModel.update(
					{ status: "LOST", failedReason: null, lastManualCheck: null },
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
		await pushToLark(site);
		await WebModel.update(
			{ lastManualCheck: null },
			{ where: { id: site.id } }
		);
		log.info(
			`ID >> ${site.id}, Result >> ${site.status} → 不做修改, Reason >> ${
				(error as Error).message
			}`,
			"BROWSER"
		);
		errorCount++;
	}
}
