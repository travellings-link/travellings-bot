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
import chalkTemplate from "chalk-template";
import fs from "fs";
import path from "path";
import { Browser, Page, launch } from "puppeteer";
import { Op } from "sequelize";

import { botManager } from "../bot/botManager";
import { config } from "../config";
import { WebModel } from "../modules/sqlModel";
import { Logger, logger, time } from "../modules/typedLogger";
import { asyncPool } from "../utils/asyncPool";
import { checkPageContent } from "../utils/checkPageContent";
import { WaitToRunMessageQueue } from "../utils/messageQueue";

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
 * @param looseMode - 可选参数，在检查时使用宽松模式。
 *
 * @returns {Promise<void | { siteURL: string; status: string}>}
 * 如果提供了 URL，则返回一个包含 siteURL 和 status 的对象；否则无返回值；status 可能是 "RUN" | "LOST" | "ERROR" | "UNKNOWN" | HTTP 状态码
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
	looseMode?: boolean,
): Promise<void | {
	siteURL: string;
	status: string;
}> {
	// 用来统计状态的字典
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
		status: string; // "RUN" | "LOST" | "ERROR" | "UNKNOWN" | HTTP 状态码
	} = { siteURL: "UNKNOWN", status: "UNKNOWN" };

	try {
		if (inputURL) {
			// 如果传入 URL 参数，则只检查指定 URL 的网站
			cliModeResult = await checkSingleURLWithRetry(
				page,
				inputURL,
				browser_logger,
				looseMode,
			);
			return cliModeResult;
		} else if (inputID) {
			// 如果传入 ID 参数，则只检查指定 ID 的网站
			const site = await WebModel.findOne({
				where: {
					id: inputID,
				},
			});

			if (site) {
				await checkSite(
					page,
					site,
					browser_logger,
					statusCounts,
					looseMode,
				);
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
						[Op.in]: ["LOST", "ERROR", "403", "WAIT"],
					},
					lastManualCheck: {
						[Op.or]: [
							{ [Op.eq]: null },
							{
								// 筛选出 lastManualCheck 字段的值在 30 天之前的记录
								[Op.lt]: new Date(
									new Date().getTime() -
										30 * 24 * 60 * 60 * 1000,
								),
							},
						],
					},
				},
			});

			// 使用 asyncPool 限制同时查询数
			const maxConcurrent = config.BROWSER_CHECK_MAX_CONCURRENT;
			await asyncPool(maxConcurrent, sitesToCheck, async (site) => {
				await checkSite(
					page,
					site,
					browser_logger,
					statusCounts,
					looseMode,
				);
				statusCounts["total"]++;
			});
		}
	} catch (error) {
		browser_logger.err(`发生错误：${error}`, "BROWSER");
	} finally {
		await browser.close();

		// CLI 模式（有传入 inputURL）跳过后面的步骤
		if (!inputURL) {
			const endTime = new Date();
			const input = (endTime.getTime() - startTime.getTime()) / 1000;

			const stats = `检测耗时：${spentTime(
				input,
			)}｜总共: ${statusCounts["total"]} 个｜RUN: ${statusCounts["run"]} 个｜LOST: ${statusCounts["lost"]} 个｜4XX: ${statusCounts["fourxx"]} 个｜5XX: ${statusCounts["fivexx"]} 个｜ERROR: ${statusCounts["errorCount"]} 个｜TIMEOUT: ${statusCounts["timeout"]} 个`;
			browser_logger.info(`检测完成 >> ${stats}`, "BROWSER");

			// 无 Token 模式跳过后面的步骤
			if (process.env["NO_TOKEN_MODE"] !== "true") {
				// 调用开往 API 清除缓存
				try {
					await axios.get(`${config.API_URL}/all`);
					await axios.delete(`${config.API_URL}/action/purgeCache`, {
						headers: { Cookie: `_tlogin=${config.API_TOKEN}` },
					});
				} catch (e) {
					logger.err((e as Error).message, "REDIS");
				}

				// 发送 bot 消息
				botManager.boardcastRichTextMessage([
					[
						{
							type: "text",
							bold: true,
							content: "开往巡查姬提醒您：",
						},
					],
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
							content:
								"备注：仅巡查 LOST、ERROR 和 403 状态的站点",
						},
					],
				]);

				// 清空队列消息
				WaitToRunMessageQueue.getInstance().clearAndNotify();
			}
		}
	}

	// lint 要求，return 不能放 finally 里
	// cli 模式的在前面的 return 了，所以这里无需判断
	return;
}

/**
 * 检查单个 URL 的网站状态，并添加重试机制。
 *
 * @param page - Puppeteer 页面实例。
 * @param siteURL - 要检查的网站 URL。
 * @param log - 日志记录器实例。
 * @param looseMode - 可选参数，在检查时使用宽松模式。
 * @param maxRetries - 最大尝试次数，默认为 3。
 * @param retryDelay - 重试等待时间，单位为毫秒，默认为 1000 毫秒。
 *
 * @returns {Promise<{ siteURL: string; status: string }>}
 * 返回一个包含 siteURL 和 status 的对象，status 的可能值包括 'RUN'、'LOST'、'ERROR'、以及 HTTP 状态码
 */
async function checkSingleURLWithRetry(
	page: Page,
	siteURL: string,
	log: Logger,
	looseMode?: boolean,
	maxRetries: number = 3,
	retryDelay: number = 1000,
): Promise<{ siteURL: string; status: string }> {
	let attempt = 0;
	let result: { siteURL: string; status: string };

	while (attempt < maxRetries) {
		result = await checkSingleURL(page, siteURL, log, looseMode);

		// 如果返回值是 RUN 或者 LOST 就不重试
		if (result.status === "RUN" || result.status === "LOST") {
			return result;
		}

		attempt++;
		if (attempt < maxRetries) {
			log.warn(
				chalkTemplate`URL >> {white ${siteURL}}, 等待 ${retryDelay} 毫秒后重试第 ${attempt} 次`,
				"BROWSER",
			);
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	return result!;
}

/**
 * 检查单个 URL 的网站状态。
 *
 * @param page - Puppeteer 页面实例。
 * @param siteURL - 要检查的网站 URL。
 * @param log - 日志记录器实例。
 * @param looseMode - 可选参数，在检查时使用宽松模式。
 *
 * @returns {Promise<{ siteURL: string; status: string }>}
 * 返回一个包含 siteURL 和 status 的对象，status 的可能值包括 'RUN'、'LOST'、'ERROR'、以及 HTTP 状态码
 */
async function checkSingleURL(
	page: Page,
	siteURL: string,
	log: Logger,
	looseMode?: boolean,
): Promise<{ siteURL: string; status: string }> {
	try {
		const [response] = await Promise.all([
			page.goto(siteURL),
			page.waitForNavigation({ waitUntil: "networkidle0" }),
		]);

		if (response && ![200, 304].includes(response.status())) {
			// 返回码不为 200, 304
			// response.ok() 为 true 是 200-299，但是可能有如 204 No Content，所以归入此类
			log.info(
				chalkTemplate`URL >> {white ${siteURL}}, Result >> {red ${response.status()}}`,
				"BROWSER",
			);
			return {
				siteURL,
				status: response.status().toString(),
			};
		}

		// 进行内容检查
		if (checkPageContent(await page.content(), looseMode)) {
			log.info(
				chalkTemplate`URL >> {white ${siteURL}}, Result >> {green RUN},`,
				"BROWSER",
			);
			return {
				siteURL,
				status: "RUN",
			};
		}

		// 未通过内容检查
		log.info(
			chalkTemplate`URL >> {white ${siteURL}}, Result >> {red LOST},`,
			"BROWSER",
		);
		return {
			siteURL,
			status: "LOST",
		};
	} catch (error) {
		log.info(
			chalkTemplate`URL >> {white ${siteURL}}, Result >> {red ERROR}, Reason >> ${(error as Error).message}`,
			"BROWSER",
		);
		return {
			siteURL,
			status: "ERROR",
		};
	}
}

/**
 * 检查指定站点的状态
 * 之后根据结果执行以下步骤
 * 1. 更新数据库
 * 2. statusCounts 对应项统计值 +1
 * 3. console 日志输出
 *
 * @param page - Puppeteer 页面实例。
 * @param site - 要检查的站点信息。
 * @param log - 日志记录器实例。
 * @param statusCounts - 一个对象，用于记录不同状态的计数
 * @param looseMode - 可选参数，在检查时是否启用宽松模式。
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
	looseMode?: boolean,
) {
	try {
		const siteStatusResult = (
			await checkSingleURLWithRetry(page, site.link, log, looseMode)
		).status;
		// lint 要求，声明不能放 case 语句里面
		let failedReason: string = "";

		switch (siteStatusResult) {
			case "RUN":
				await site.update({
					status: "RUN",
					failedReason: null,
					lastManualCheck: null,
				});

				statusCounts["run"]++;

				log.info(
					chalkTemplate`ID >> {white ${site.id}}, Result >> ${site.status} → {green RUN}`,
					"BROWSER",
				);
				return;
			case "LOST":
				await site.update({
					status: "LOST",
					failedReason: null,
					lastManualCheck: null,
				});

				statusCounts["lost"]++;

				log.info(
					chalkTemplate`ID >> {white ${site.id}}, Result >> ${site.status} → {red LOST}`,
					"BROWSER",
				);
				return;
			default:
				await site.update({
					status: siteStatusResult,
					failedReason: null,
					lastManualCheck: null,
				});

				if (siteStatusResult.startsWith("4")) {
					failedReason = "Client Error";
					statusCounts["fourxx"]++;
				} else if (siteStatusResult.startsWith("5")) {
					failedReason = "Server Error";
					statusCounts["fivexx"]++;
				} else {
					failedReason = siteStatusResult;
					statusCounts["errorCount"]++;
				}

				log.info(
					chalkTemplate`ID >> {white ${site.id}}, Result >> ${site.status} → {red ${siteStatusResult}}, Reason >> ${failedReason}: ${siteStatusResult}`,
					"BROWSER",
				);
				return;
		}
	} catch (error) {
		await site.update({ lastManualCheck: null });

		statusCounts["errorCount"]++;

		log.info(
			chalkTemplate`ID >> {white ${site.id}}, Result >> ${site.status} → {yellow 不做修改}, Reason >> ${(error as Error).message}`,
			"BROWSER",
		);
	}
}
