//     _          _              ____      _
//    / \   __  _(_) ___  ___   / ___| ___| |_
//   / _ \  \ \/ / |/ _ \/ __| | |  _ / _ \ __|
//  / ___ \  >  <| | (_) \__ \ | |_| |  __/ |_
// /_/   \_\/_/\_\_|\___/|___/  \____|\___|\__|
//
// Axios Get Check Websites Util
// By <huixcwg@gmail.com>
// 2024/01/16 04:42 CST
// Migrated to ESM & Typescript on 2024/10/10 by Allenyou <i@allenyou.wang>
import axios, { AxiosError } from "axios";
import axiosRetry, { exponentialDelay } from "axios-retry";
import chalkTemplate from "chalk-template";
import { Op } from "sequelize";

import { botManager } from "../bot/botManager";
import { config } from "../config";
import { WebModel } from "../modules/sqlModel";
import { Logger } from "../modules/typedLogger";
import { asyncPool } from "../utils/asyncPool";
import { checkPageContent } from "../utils/checkPageContent";
import { clearTravellingsAPICache } from "../utils/clearTravellingsAPICache";
import { WaitToRunMessageQueue } from "../utils/messageQueue";
import { durationTime, time } from "../utils/time";

/**
 * 判断 HTTP 状态码是否需要重试。
 *
 * @param statusCode - HTTP 状态码，可以是数字或字符串。
 * @returns {boolean} - 如果需要重试则返回 true，否则返回 false。
 */
function shouldRetry(statusCode: number | string): boolean {
	const code =
		typeof statusCode === "string" ? parseInt(statusCode, 10) : statusCode;
	return code === 429 || (code >= 500 && code <= 599); // 需要重试的范围 429、500-599
}

// 处理 axios.interceptors.response.use 在 onFulfilled 的情况
axios.interceptors.response.use(
	(response) => {
		// 处理响应数据
		const { config, request } = response;
		// 已经到达重试次数，直接跳过后面的检查
		// 否则后面的日志处理会由于 return Promise.reject 按照 ERROR 处理，而不是 RESPONSE
		// 举例：
		// 日志按照 ERROR 处理：Result >> ERROR, Reason >> Axios Error：521
		// 日志按照 RESPONSE 处理：Result >> 521, Reason >> Server Error：521, Title：undefined
		if (
			config["axios-retry"]?.retries === config["axios-retry"]?.retryCount
		) {
			return response;
		}

		// 通过 HTTP 状态码判断是否需要重试
		if (shouldRetry(response.status)) {
			return Promise.reject(
				new AxiosError(
					response.status.toString(),
					"RETRY",
					config,
					request,
					response,
				),
			); // 这里 reject 之后会移交给 axiosRetry 处理
		}

		// 不在重试范围，不做处理
		return response;
	},
	null, // axiosRetry 会处理 onRejected，这里直接 null 即可
);

// 配置 axios-retry 自动重试，处理 axios.interceptors.response.use 在 onRejected 的情况
axiosRetry(axios, {
	retries: 2, // 这里设置为 2，是第一次失败后再来 retries 次，所以一共是试 3 次
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onRetry: (retryCount, error, _requestConfig) => {
		new Logger("_Axios").warn(
			chalkTemplate`{white ${error.config?.url}} 开始第 ${retryCount} 次重试`,
			"AXIOS",
		);
		return;
	},
	retryCondition: (error) => {
		return (
			error.code !== undefined &&
			["ECONNABORTED", "ECONNRESET", "RETRY"].includes(error.code)
			// 拦截 ECONNABORTED ECONNRESET 这两种，再加个 RETRY 支持
		);
	},
	retryDelay: exponentialDelay,
	shouldResetTimeout: true,
});

const axiosConfig = {
	headers: {
		Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
		"Accept-Encoding": "gzip, deflate, br",
		"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
		"Sec-Ch-Ua":
			'"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
		"Sec-Ch-Ua-Mobile": "?0",
		"Sec-Ch-Ua-Platform": '"Windows"',
		"Sec-Fetch-Dest": "document",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-Site": "none",
		"Sec-Fetch-User": "?1",
		"Upgrade-Insecure-Requests": "1",
		Referer: "https://www.travellings.cn/go.html",
		"User-Agent":
			"Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
	},
	timeout: config.LOAD_TIMEOUT * 1000,
	maxRedirects: 5,
	validateStatus: null,
};

/**
 * 检查网站的状态，并根据传入的参数决定检查单个 URL 或者多个网站。
 *
 * @param inputID - 可选参数，指定要检查的网站 ID。
 * @param inputURL - 可选参数，指定要检查的网站 URL。
 * @param looseMode - 可选参数，在检查时使用宽松模式。
 *
 * @returns {Promise<void | { siteURL: string; status: string; failedReason: string | null }>}
 * 如果提供了 URL，则返回一个包含 siteURL、status、failedReason 的对象；否则无返回值。
 */
export default async function normalCheck(
	inputID?: number,
	inputURL?: string,
	looseMode?: boolean,
): Promise<void | {
	siteURL: string;
	status: string;
	failedReason: string | null;
}> {
	const axios_logger = new Logger("_Axios");
	const startTime = new Date();
	let webs: WebModel[] = [];

	if (inputURL) {
		// 如果传入 URL 参数，则只检查指定 URL 的网站
		return await checkSingleURL(inputURL, axios_logger, looseMode);
	}
	if (inputID) {
		// 如果传入参数，则只检查指定 ID 的网站
		const site = await WebModel.findOne({
			where: {
				id: inputID,
			},
		});

		if (site) {
			webs = [site];
		} else {
			axios_logger.err("指定的 ID 不存在", "AXIOS");
			return;
		}
	} else {
		// 如果未传入参数，则检查所有网站
		webs = await WebModel.findAll({
			where: {
				lastManualCheck: {
					[Op.or]: [
						{ [Op.eq]: null },
						{
							// 筛选出 lastManualCheck 字段的值在 30 天之前的记录
							[Op.lt]: new Date(
								new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
							),
						},
					],
				},
			},
		});
	}

	// 统计站点状态，用于日志输出
	const statusCounts = {
		total: 0,
		run: 0,
		lost: 0,
		errorCount: 0,
		timeout: 0,
		fourxx: 0,
		fivexx: 0,
	};

	// 使用 asyncPool 限制同时查询数
	const maxConcurrent = config.AXIOS_CHECK_MAX_CONCURRENT;
	await asyncPool(maxConcurrent, webs, async (web) => {
		await checkSite(web, axios_logger, statusCounts, looseMode);
		statusCounts.total++;
	});

	const endTime = new Date();
	const input = (endTime.getTime() - startTime.getTime()) / 1000;

	// 调用开往 API 清除缓存
	clearTravellingsAPICache(axios_logger);

	// 发送 bot 消息
	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "开往巡查姬提醒您：" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "本次巡查方式：Axios" }],
		[{ type: "text", content: `持续了 ${durationTime(input)}` }],
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
		[{ type: "text", bold: true, content: "备注：巡查所有站点" }],
	]);

	// 无 Token 模式跳过此部分
	if (!config.NO_TOKEN_MODE) {
		// 清空队列消息
		WaitToRunMessageQueue.getInstance().clearAndNotify();
	}

	// 发送日志
	const stats = `检测耗时：${durationTime(input)}｜总共: ${statusCounts["total"]} 个｜RUN: ${statusCounts["run"]} 个｜LOST: ${statusCounts["lost"]} 个｜4XX: ${statusCounts["fourxx"]} 个｜5XX: ${statusCounts["fivexx"]} 个｜ERROR: ${statusCounts["errorCount"]} 个｜TIMEOUT: ${statusCounts["timeout"]} 个`;
	axios_logger.info(` 检测完成 >> ${stats}`, "AXIOS");
}

/**
 * 检查单个 URL 的网站状态。
 *
 * @param siteURL - 要检查的网站 URL。
 * @param axios_logger - 日志记录器实例
 * @param looseMode - 可选参数，在检查时使用宽松模式。
 * @returns {Promise<{ siteURL: string; status: string; failedReason: string | null }>} - 返回一个包含 siteURL、status、failedReason 的对象的 Promise。
 */
async function checkSingleURL(
	siteURL: string,
	axios_logger: Logger,
	looseMode?: boolean,
): Promise<{ siteURL: string; status: string; failedReason: string | null }> {
	const result = {
		link: siteURL,
		status: "",
		failedReason: null as string | null,
	};

	try {
		const response = await axios.get(result.link, axiosConfig);
		let data = response.data;

		if (Buffer.isBuffer(data)) {
			data = data.toString(); // 将 Buffer 转换为字符串
		} else if (typeof data !== "string") {
			data = JSON.stringify(data); // 将非字符串类型转换为 JSON 字符串
		}

		const title = (data.match(/<title>(.*?)<\/title>/i) || [])[1];

		if (response.status.toString().startsWith("4")) {
			result.status = response.status.toString();
			result.failedReason = `Client Error：${response.status}, Title：${title}`;
		} else if (response.status.toString().startsWith("5")) {
			result.status = response.status.toString();
			result.failedReason = `Server Error：${response.status}, Title：${title}`;
		} else if ([200, 304].includes(response.status)) {
			if (checkPageContent(response.data, looseMode)) {
				result.status = "RUN";
				result.failedReason = null;
			} else {
				result.status = "LOST";
				result.failedReason = null;
			}
		} else {
			// 兜底特殊 HTTP CODE
			result.status = "ERROR";
			result.failedReason = response.status.toString();
		}
	} catch (error) {
		if (error instanceof AxiosError) {
			if (error.code === "ECONNABORTED") {
				result.status = "TIMEOUT";
				result.failedReason = `Axios Error：连接超时（预设时间：${config.LOAD_TIMEOUT} 秒）`;
			} else if (error.code === "ENOTFOUND") {
				result.status = "ERROR";
				result.failedReason = `Axios Error：DNS 解析失败（域名不存在）`;
			} else if (error.code === "ECONNREFUSED") {
				result.status = "ERROR";
				result.failedReason = `Axios Error：连接被拒绝（ECONNREFUSED）`;
			} else if (error.code === "ECONNRESET") {
				result.status = "ERROR";
				result.failedReason = `Axios Error：连接被重置（ECONNRESET）`;
			} else {
				result.status = "ERROR";
				result.failedReason = `Axios Error：${error.message}`;
			}
		} else {
			result.status = "ERROR";
			result.failedReason =
				error instanceof Error ? error.message : String(error);
		}
	} finally {
		if (result.status === "RUN") {
			axios_logger.info(
				chalkTemplate`URL >> {white ${result.link}}, Result >> {green RUN}`,
				"AXIOS",
			);
		} else {
			axios_logger.info(
				chalkTemplate`URL >> {white ${result.link}}, Result >> {red ${result.status}}, Reason >> ${result.failedReason}`,
				"AXIOS",
			);
		}
	}
	return {
		siteURL,
		status: result.status,
		failedReason: result.failedReason,
	};
}

/**
 * 检查网站的状态，并更新数据库中的状态信息。
 *
 * @param web - 要检查的 WebModel 实例
 * @param axios_logger - 日志记录器实例
 * @param statusCounts - 一个对象，用于记录不同状态的计数
 * @param looseMode - 可选参数，在检查时使用宽松模式。
 * @returns {Promise<void>} - 异步函数，无返回值
 */
async function checkSite(
	web: WebModel,
	axios_logger: Logger,
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
	const checkResult = await checkSingleURL(web.link, axios_logger, looseMode);

	if (checkResult.status == "RUN") {
		statusCounts.run++;
	} else if (checkResult.status == "LOST") {
		statusCounts.lost++;
	} else if (checkResult.status.startsWith("4")) {
		statusCounts.fourxx++;
	} else if (checkResult.status.startsWith("5")) {
		statusCounts.fivexx++;
	} else if (checkResult.status == "TIMEOUT") {
		statusCounts.timeout++;
	} else {
		// checkResult.status === "ERROR" or 其他特殊 HTTP CODE
		statusCounts.errorCount++;
	}

	// 提交数据库修改
	await WebModel.update(
		{
			status: checkResult.status,
			failedReason: checkResult.failedReason,
			lastManualCheck: null,
		},
		{ where: { id: web.id } },
	);

	if (checkResult.status === "RUN") {
		axios_logger.info(
			chalkTemplate`ID >> {white ${web.id}}, Result >> {green RUN}`,
			"AXIOS",
		);
	} else {
		axios_logger.info(
			chalkTemplate`ID >> {white ${web.id}}, Result >> {red ${checkResult.status}}, Reason >> ${checkResult.failedReason}`,
			"AXIOS",
		);
	}
}
