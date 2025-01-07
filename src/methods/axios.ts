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
import { config } from "../config";
import { Op } from "sequelize";
import { WebModel } from "../modules/sqlModel";
import { Logger, time } from "../modules/typedLogger";
import { botManager } from "../bot/botManager";

const axiosConfig = {
	headers: {
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
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

// 定义 log
function spentTime(input: number) {
	const hours = Math.floor(input / 3600);
	const minutes = Math.floor((input % 3600) / 60);
	const seconds = Math.floor(input % 60);
	return `${hours}小时 ${minutes}分 ${seconds}秒`;
}

export default async function normalCheck(inputID?: number) {
	const axios_logger = new Logger("_Axios");
	const startTime = new Date();
	let webs: WebModel[] = [];

	if (inputID) {
		// 如果传入参数，则只检查指定的网站
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
				status: {
					[Op.notIn]: ["WAIT"],
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
	}

	let total = 0,
		run = 0,
		lost = 0,
		errorCount = 0,
		timeout = 0,
		fourxx = 0,
		fivexx = 0;

	for (const web of webs) {
		total++;

		try {
			const response = await axios.get(web.link, axiosConfig);
			let data = response.data;

			if (Buffer.isBuffer(data)) {
				data = data.toString(); // 将 Buffer 转换为字符串
			} else if (typeof data !== "string") {
				data = JSON.stringify(data); // 将非字符串类型转换为 JSON 字符串
			}

			const title = (data.match(/<title>(.*?)<\/title>/i) || [])[1];

			if (
				response.status === 200 &&
				(response.data.includes("travelling") || response.data.includes("开往"))
			) {
				web.status = "RUN";
				web.failedReason = null;
				run++;
			} else if (response.status.toString().startsWith("4")) {
				web.status = response.status.toString();
				web.failedReason = `Client Error：${response.status}, Title：${title}`;
				fourxx++;
			} else if (response.status.toString().startsWith("5")) {
				web.status = response.status.toString();
				web.failedReason = `Server Error：${response.status}, Title：${title}`;
				fivexx++;
			} else {
				web.status = "LOST";
				web.failedReason = null;
				lost++;
			}
			web.lastManualCheck = null;
			axios_logger.info(
				`ID >> ${web.id}, Result >> ${web.status}, Reason >> ${web.failedReason}`,
				"AXIOS"
			);
		} catch (error) {
			if (error instanceof AxiosError) {
				if (error.code === "ECONNABORTED") {
					web.status = "TIMEOUT";
					web.failedReason = `Axios Error：连接超时（预设时间：${config.LOAD_TIMEOUT} 秒）`;
					timeout++;
				} else if (error.code === "ENOTFOUND") {
					web.status = "ERROR";
					web.failedReason = `Axios Error：DNS 解析失败（域名不存在）`;
					errorCount++;
				} else if (error.code === "ECONNREFUSED") {
					web.status = "ERROR";
					web.failedReason = `Axios Error：连接被拒绝（ECONNREFUSED）`;
					errorCount++;
				} else if (error.code === "ECONNRESET") {
					web.status = "ERROR";
					web.failedReason = `Axios Error：连接被重置（ECONNRESET）`;
					errorCount++;
				} else {
					web.status = "ERROR";
					web.failedReason = `Axios Error：${error.message}`;
					errorCount++;
				}
				web.lastManualCheck = null;
				axios_logger.info(
					`ID >> ${web.id}, Result >> ${web.status}, Reason >> ${web.failedReason}`,
					"AXIOS"
				);
			}
		} finally {
			await web.save();
		}
	}

	const endTime = new Date();
	const input = (endTime.getTime() - startTime.getTime()) / 1000;
	// 清除 Redis 缓存
	try {
		await axios.get(`${config.API_URL}/all`);
		await axios.delete(`${config.API_URL}/action/purgeCache`, {
			headers: { Cookie: `_tlogin=${config.API_TOKEN}` },
		});
	} catch (e) {
		axios_logger.err((e as Error).message, "REDIS");
	}

	const stats = `检测耗时：${spentTime(
		input
	)}｜总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个`;
	axios_logger.info(` 检测完成 >> ${stats}`, "AXIOS");
	axios_logger.close();
	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "开往巡查姬提醒您：" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "本次巡查方式：Axios" }],
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
		[{ type: "text", bold: true, content: "备注：巡查所有站点" }],
	]);
	// botManager.boardcastMessage(
	// 	`<strong>开往巡查姬提醒您：</strong>\n\n本次巡查方式：Axios\n持续了 ${spentTime(
	// 		input
	// 	)}\n\n<strong>巡查报告</strong>\n总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个\n\n发送时间：${time()} CST\n备注：巡查所有站点`
	// );
}
