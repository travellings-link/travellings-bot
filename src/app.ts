//  _____                    _ _ _                     ____ _               _       ____        _
// |_   _| __ __ ___   _____| | (_)_ __   __ _ ___    / ___| |__   ___  ___| | __  | __ )  ___ | |_
//   | || '__/ _` \ \ / / _ \ | | | '_ \ / _` / __|  | |   | '_ \ / _ \/ __| |/ /  |  _ \ / _ \| __|
//   | || | | (_| |\ V /  __/ | | | | | | (_| \__ \  | |___| | | |  __/ (__|   <   | |_) | (_) | |_
//   |_||_|  \__,_| \_/ \___|_|_|_|_| |_|\__, |___/   \____|_| |_|\___|\___|_|\_\  |____/ \___/ \__|
//                                       |___/
//
// Travellings Check Bot Main
// By BLxcwg666 <huixcwg@gmail.com>
// 2024/01/16 18:10 CST
import chalkTemplate from "chalk-template";
import { writeFileSync } from "fs";
import { schedule } from "node-cron";
import { Op } from "sequelize";

import { LarkAdapter } from "./bot/adapters/larkAdapter";
import { TelegramAdapter } from "./bot/adapters/telegramAdapter";
import { botManager } from "./bot/botManager";
import { check } from "./bot/commands/check";
import { help } from "./bot/commands/help";
import { query } from "./bot/commands/query";
import { screenshot } from "./bot/commands/screenshot";
import { version } from "./bot/commands/version";
import { requireAdmin } from "./bot/middlewares/requireAdmin";
import { requireSpecifiedChat } from "./bot/middlewares/requireSpecifiedChat";
import { config } from "./config";
import axiosCheck from "./methods/axios";
import browserCheck from "./methods/browser";
import sql from "./modules/sqlConfig";
import { WebModel } from "./modules/sqlModel";
import { logger } from "./modules/typedLogger";
import { asyncPool } from "./utils/asyncPool";
import { clearTravellingsAPICache } from "./utils/clearTravellingsAPICache";
import { time } from "./utils/time";

export const global = {
	version: "8.0.0",
};

async function checkAll() {
	logger.info("✓ 开始巡查站点", "APP");

	// 备份巡查前的数据库
	const webModels = await WebModel.findAll();

	await axiosCheck();
	await browserCheck();

	const runWebsCount = await WebModel.count({
		where: {
			status: {
				[Op.in]: ["RUN"],
			},
			lastManualCheck: {
				[Op.or]: [
					{ [Op.eq]: null },
					{
						[Op.lt]: new Date(
							new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
						),
					},
				],
			},
		},
	});
	const allWebsCount = await WebModel.count({
		where: {
			status: {
				[Op.notIn]: ["WAIT"],
			},
			lastManualCheck: {
				[Op.or]: [
					{ [Op.eq]: null },
					{
						[Op.lt]: new Date(
							new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
						),
					},
				],
			},
		},
	});
	// 计算百分比：检查为 RUN 的站点数/需要检查的站点数
	const runWebsPercentage = (runWebsCount / allWebsCount) * 100;
	// 可接受的最低占比
	const minRunSitesPercentage = config.MIN_RUN_SITES_PERCENTAGE;
	if (runWebsPercentage < minRunSitesPercentage) {
		logger.warn(
			`△ 状态正常的站点占比低于 ${minRunSitesPercentage}%: ${runWebsPercentage.toFixed(2)}%`,
			"APP",
		);
		// 撤回数据库修改
		await WebModel.bulkCreate(webModels, { updateOnDuplicate: ["id"] });

		// 调用开往 API 清除缓存
		clearTravellingsAPICache(logger);

		// 发送 bot 消息
		botManager.boardcastRichTextMessage([
			[{ type: "text", bold: true, content: "开往巡查姬提醒您：" }],
			[{ type: "text", content: "" }],
			[
				{
					type: "text",
					content: `巡查机巡查结果异常`,
				},
			],
			[
				{
					type: "text",
					bold: true,
					content: `状态正常的站点占比为 ${runWebsPercentage.toFixed(2)}%`,
				},
			],
			[
				{
					type: "text",
					content: `低于可接受的最低占比 ${minRunSitesPercentage}%`,
				},
			],
			[{ type: "text", content: "" }],
			[{ type: "text", content: `已自动撤回此次巡查的数据库修改` }],
		]);
	} else {
		logger.ok(
			`✓ 状态正常的站点占比 ${runWebsPercentage.toFixed(2)}%`,
			"APP",
		);
	}
	logger.ok("✓ 检测完成", "APP");
}

// 获取命令行参数
const args = process.argv.slice(2);
// 检查是否包含 -public-mode 标志
const isLocalDebug = args.includes("-public-mode");
// 检查是否包含 -cli 标志
const isCLIMode = args.includes("-cli");

console.log(`\n
_____                    _ _ _                     ____ _               _       ____        _   
|_   _| __ __ ___   _____| | (_)_ __   __ _ ___    / ___| |__   ___  ___| | __  | __ )  ___ | |_ 
 | || '__/ _\` \\ \\ / / _ \\ | | | '_ \\ / _\` / __|  | |   | '_ \\ / _ \\/ __| |/ /  |  _ \\ / _ \\| __|
 | || | | (_| |\\ V /  __/ | | | | | | (_| \\__ \\  | |___| | | |  __/ (__|   <   | |_) | (_) | |_ 
 |_||_|  \\__,_| \\_/ \\___|_|_|_|_| |_|\\__, |___/   \\____|_| |_|\\___|\\___|_|\\_\\  |____/ \\___/ \\__|
                                     |___/                                                      

          Copyright © 2020-2025 Travellings Project. All rights reserved.  //  Version ${global.version}
`);

interface SiteResults {
	results: {
		[key: string]: {
			browserCheck: {
				status: string;
			};
			axiosCheck: { status: string; failedReason: string | null };
		};
	};
}

if (isCLIMode) {
	// 过滤掉 -cli 项
	const urls = args.filter((arg) => arg !== "-cli");
	const siteResults: SiteResults = { results: {} };
	for (const url of urls) {
		// 初始化对象
		siteResults.results[url] = {
			browserCheck: { status: "UNKNOWN" },
			axiosCheck: { status: "UNKNOWN", failedReason: "UNKNOWN" },
		};
	}

	// 进行 Axios 检查，使用 asyncPool 限制同时查询数
	await asyncPool(config.AXIOS_CHECK_MAX_CONCURRENT, urls, async (url) => {
		logger.info(`axiosCheck 开始巡查站点 \x1b[0m${url}\x1b[34m`, "APP");
		await axiosCheck(undefined, url).then((axiosResult) => {
			if (!axiosResult) {
				logger.err(
					`\x1b[0m${url}\x1b[34m 未能获取到 axiosCheck 的结果`,
					"APP",
				);
			} else {
				if (siteResults.results[url]) {
					siteResults.results[url]["axiosCheck"]["status"] =
						axiosResult.status;
					siteResults.results[url]["axiosCheck"]["failedReason"] =
						axiosResult.failedReason;
				}
			}
		});
	});

	// 进行 Browser 检查，使用 asyncPool 限制同时查询数
	await asyncPool(config.BROWSER_CHECK_MAX_CONCURRENT, urls, async (url) => {
		logger.info(
			chalkTemplate`browserCheck 开始巡查站点 {reset ${url}}`,
			"APP",
		);
		await browserCheck(undefined, url).then((browserResult) => {
			if (!browserResult) {
				logger.err(
					chalkTemplate`{reset ${url}} 未能获取到 browserCheck 的结果`,
					"APP",
				);
			} else {
				if (siteResults.results[url]) {
					siteResults.results[url].browserCheck.status =
						browserResult.status;
				}
			}
		});
	});

	logger.ok("△ 检测完成", "APP");
	writeFileSync("results.json", JSON.stringify(siteResults, null, 2));
	logger.info("✓ 结果已保存到 results.json", "APP");
	process.exit(0);
}

logger.info("尝试连接到数据库...", "APP");
await sql
	.sync()
	.then(() => {
		logger.ok("成功连接到数据库 ~", "APP");
	})
	.catch((err) => {
		logger.err((err as Error).message, "APP");
	}); // 数据库同步 + 错误处理

if (isLocalDebug) {
	// 本地 debug 模式 检查完就退出
	logger.info("进入本地开发模式...", "APP");
	config.NO_TOKEN_MODE = true;
	await checkAll();
	process.exit(0);
}

botManager.registerAdapter(new TelegramAdapter());
botManager.registerAdapter(new LarkAdapter());

botManager.registerCommand("help", help);
botManager.registerCommand("version", version);
botManager.registerCommand("query", requireSpecifiedChat(query));
botManager.registerCommand("check", requireSpecifiedChat(requireAdmin(check)));
botManager.registerCommand(
	"screenshot",
	requireSpecifiedChat(requireAdmin(screenshot)),
);

logger.info("没到点呢，小睡一会 ~", "APP");

schedule("0 4 * * *", () => {
	logger.info(`定时任务开始！当前时间 ${time()}`, "APP");
	checkAll();
});
