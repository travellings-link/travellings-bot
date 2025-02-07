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
import axios from "axios";
import fs from "fs";
import path from "path";
import { Browser, Page, launch } from "puppeteer";
import { Op } from "sequelize";

import { botManager } from "../bot/botManager";
import { config } from "../config";
import { WebModel } from "../modules/sqlModel";
import { Logger, logger, time } from "../modules/typedLogger";
import { asyncPool } from "../utils/asyncPool";

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

/**
 * 检查网站的状态，并根据传入的参数决定检查单个 URL 或者多个网站。
 *
 * @param inputID - 可选参数，指定要检查的网站 ID。
 * @param inputURL - 可选参数，指定要检查的网站 URL。
 *
 * @returns {Promise<void | { siteURL: string; status: 'RUN' | 'LOST' | 'ERROR' | "UNKNOWN"}>}
 * 如果提供了 URL，则返回一个包含 siteURL 和 status 的对象；否则无返回值
 *
 * @example
 * // 检查指定 ID 的网站
 * await browserCheck(123);
 *
 * @example
 * // 检查指定 URL 的网站
 * await browserCheck(undefined, "https://example.com");
 *
 * @example
 * // 检查所有符合条件的网站
 * await browserCheck();
 */
export default async function browserCheck(
	inputID?: number,
	inputURL?: string,
): Promise<void | {
	siteURL: string;
	status: "RUN" | "LOST" | "ERROR" | "UNKNOWN";
}> {
	const statusCounts = {
		total: 0,
		run: 0,
		lost: 0,
		errorCount: 0,
		timeout: 0,
		fourxx: 0,
		fivexx: 0,
	};

	const browser_logger = new Logger("_Browser");

	let browser: Browser;
	try {
		browser = await launch({
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
	} catch (error) {
		browser_logger.err(`发生错误：${error}`, "BROWSER");
		browser_logger.err(`启用备用初始化浏览器方案`, "BROWSER");
		browser = await launch({
			headless: true,
			args: [
				"--disable-features=StylesWithCss=false",
				"--blink-settings=imagesEnabled=false",
				"--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
				"--disable-logging",
				"--log-level=3",
				"--no-sandbox",
				"--disable-setuid-sandbox",
			],
		});
	}
	const page = await browser.newPage();
	await page.setViewport({ width: 1920, height: 1080 });
	// await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);
	await page.setExtraHTTPHeaders({
		referer: "https://www.travellings.cn/go.html", // 来自开往的 Referer
	});
	const startTime = new Date();

	let cliModeResult: {
		siteURL: string;
		status: "RUN" | "LOST" | "ERROR" | "UNKNOWN";
	} = { siteURL: "UNKNOWN", status: "UNKNOWN" };

	try {
		if (inputURL) {
			// 如果传入 URL 参数，则只检查指定 URL 的网站
			cliModeResult = await checkSingleURL(
				page,
				inputURL,
				browser_logger,
			);
		} else if (inputID) {
			// 如果传入 ID 参数，则只检查指定 ID 的网站
			const site = await WebModel.findOne({
				where: {
					id: inputID,
				},
			});

			if (site) {
				await checkSite(page, site, browser_logger, statusCounts);
				statusCounts["total"]++;
			} else {
				browser_logger.err("指定的 ID 不存在", "BROWSER");
				return;
			}
		} else {
			// 检查全部数据库中符合要求的网站
			// 筛选出符合要求的网站
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
									new Date().getTime() -
										30 * 24 * 60 * 60 * 1000,
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
					},
				);
			}

			// 使用 asyncPool 限制同时查询数
			const maxConcurrent = config.BROWSER_CHECK_MAX_CONCURRENT;
			await asyncPool(maxConcurrent, sitesToCheck, async (site) => {
				await checkSite(page, site, browser_logger, statusCounts);
				statusCounts["total"]++;
			});
		}
	} catch (error) {
		browser_logger.err(`发生错误：${error}`, "BROWSER");
	} finally {
		await browser.close();

		// CLI 模式（有传入 inputURL），就跳过后面的步骤
		if (!inputURL) {
			const endTime = new Date();
			const input = (endTime.getTime() - startTime.getTime()) / 1000;
			// 清除 Redis 缓存
			if (process.env["PUBLIC_MODE"] !== "true") {
				try {
					await axios.get(`${config.API_URL}/all`);
					await axios.delete(`${config.API_URL}/action/purgeCache`, {
						headers: { Cookie: `_tlogin=${config.API_TOKEN}` },
					});
				} catch (e) {
					logger.err((e as Error).message, "REDIS");
				}
			}

			const stats = `检测耗时：${spentTime(
				input,
			)}｜总共: ${statusCounts["total"]} 个｜RUN: ${statusCounts["run"]} 个｜LOST: ${statusCounts["lost"]} 个｜4XX: ${statusCounts["fourxx"]} 个｜5XX: ${statusCounts["fivexx"]} 个｜ERROR: ${statusCounts["errorCount"]} 个｜TIMEOUT: ${statusCounts["timeout"]} 个`;
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
						content: `总共: ${statusCounts["total"]} 个｜RUN: ${statusCounts["run"]} 个｜LOST: ${statusCounts["lost"]} 个｜4XX: ${statusCounts["fourxx"]} 个｜5XX: ${statusCounts["fivexx"]} 个｜ERROR: ${statusCounts["errorCount"]} 个｜TIMEOUT: ${statusCounts["timeout"]} 个`,
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
			// 	)}\n\n<strong>巡查报告</strong>\n总共: ${statusCounts["total"]} 个｜RUN: ${statusCounts["run"]} 个｜LOST: ${statusCounts["lost"]} 个｜4XX: ${statusCounts["fourxx"]} 个｜5XX: ${statusCounts["fivexx"]} 个｜ERROR: ${statusCounts["errorCount"]} 个｜TIMEOUT: ${statusCounts["timeout"]} 个\n\n发送时间：${time()} CST\n备注：仅巡查 LOST 和 ERROR 状态的站点`
			// );
		}
	}

	// lint 要求，return 不能放 finally 里
	if (inputURL) {
		return cliModeResult;
	} else {
		return;
	}
}

/**
 * 将站点信息推送到 Lark。
 *
 * @param site - 要推送的站点信息。
 *
 * @returns {Promise<void>} - 异步函数，无返回值。
 */
async function pushToLark(site: WebModel) {
	if (
		process.env["PUBLIC_MODE"] === "true" ||
		config.LARK_ADD_TOKEN === undefined
	) {
		// 无 Token 模式运行，不 push || 未设置 Token，不 push
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
		},
	);
}

/**
 * 检查给定页面内容是否包含特定关键字或链接。
 *
 * 该函数会搜索页面内容中是否存在某些英文和中文关键字，以及特定的链接。它旨在判断内容是否与 “travelling” 或 “开往” 相关，并检测是否包括任何许可的外部链接。
 *
 * @param pageContent - 要检查的页面内容。
 * @returns 如果页面内容包含任意指定的关键字或链接，则返回 `true`，否则返回 `false`。
 */
function checkPageContent(pageContent: string) {
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
	const includeLink = links.some((link) => pageContent.includes(link));
	return includeEN || includeZH || includeLink;
}

/**
 * 检查单个 URL 的网站状态。
 *
 * @param page - Puppeteer 页面实例。
 * @param siteURL - 要检查的网站 URL。
 * @param log - 日志记录器实例。
 *
 * @returns {Promise<{ siteURL: string; status: 'RUN' | 'LOST' | 'ERROR' }>}
 * 返回一个包含 siteURL 和 status 的对象，status 的可能值包括 'RUN'、'LOST' 和 'ERROR'
 */
async function checkSingleURL(
	page: Page,
	siteURL: string,
	log: Logger,
): Promise<{ siteURL: string; status: "RUN" | "LOST" | "ERROR" }> {
	try {
		await Promise.all([
			page.goto(siteURL),
			page.waitForNavigation({ waitUntil: "networkidle0" }),
		]);

		const pageContent = await page.content();

		if (checkPageContent(pageContent)) {
			log.info(
				`URL >> \x1b[0m${siteURL}\x1b[34m, Result >> \x1b[32mRUN\x1b[34m,`,
				"BROWSER",
			);
			return {
				siteURL,
				status: "RUN",
			};
		} else {
			log.info(
				`URL >> \x1b[0m${siteURL}\x1b[34m, Result >> \x1b[31mLOST\x1b[34m,`,
				"BROWSER",
			);
			return {
				siteURL,
				status: "LOST",
			};
		}
	} catch (error) {
		log.info(
			`URL >> \x1b[0m${siteURL}\x1b[34m, Result >> \x1b[31mERROR\x1b[34m, Reason >> ${(error as Error).message}`,
			"BROWSER",
		);
		return {
			siteURL,
			status: "ERROR",
		};
	}
}

/**
 * 检查指定站点的状态，并更新数据库中的状态，包括 pushToLark。
 *
 * @param page - Puppeteer 页面实例。
 * @param site - 要检查的站点信息。
 * @param log - 日志记录器实例。
 * @param statusCounts - 一个对象，用于记录不同状态的计数
 *
 * @returns {Promise<void>} - 异步函数，无返回值。
 */
async function checkSite(
	page: Page,
	site: WebModel,
	log: Logger,
	statusCounts: {
		total: number;
		run: number;
		lost: number;
		errorCount: number;
		timeout: number;
		fourxx: number;
		fivexx: number;
	},
) {
	try {
		await Promise.all([
			page.goto(site.link),
			page.waitForNavigation({ waitUntil: "networkidle0" }),
		]);

		if (parseInt(site.status) >= 500) {
			log.info(`ID >> ${site.id}, Result >> 不做修改`, "BROWSER");
			statusCounts["fourxx"]++;
		} else {
			const pageContent = await page.content();

			if (checkPageContent(pageContent)) {
				await WebModel.update(
					{
						status: "RUN",
						failedReason: null,
						lastManualCheck: null,
					},
					{ where: { id: site.id } },
				);
				log.info(
					`ID >> ${site.id}, Result >> ${site.status} → RUN`,
					"BROWSER",
				);
				statusCounts["run"]++;
			} else {
				await pushToLark(site);
				await WebModel.update(
					{
						status: "LOST",
						failedReason: null,
						lastManualCheck: null,
					},
					{ where: { id: site.id } },
				);
				log.info(
					`ID >> ${site.id}, Result >> ${site.status} → LOST`,
					"BROWSER",
				);
				statusCounts["lost"]++;
			}
		}
	} catch (error) {
		await pushToLark(site);
		await WebModel.update(
			{ lastManualCheck: null },
			{ where: { id: site.id } },
		);
		log.info(
			`ID >> ${site.id}, Result >> ${site.status} → 不做修改, Reason >> ${(error as Error).message}`,
			"BROWSER",
		);
		statusCounts["errorCount"]++;
	}
}
