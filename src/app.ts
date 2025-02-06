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

import { schedule } from "node-cron";
import sql from "./modules/sqlConfig";
import axiosCheck from "./methods/axios";
import browserCheck from "./methods/browser";
import { botManager } from "./bot/botManager";
import { TelegramAdapter } from "./bot/adapters/telegramAdapter";
import { help } from "./bot/commands/help";
import { check } from "./bot/commands/check";
import { query } from "./bot/commands/query";
import { version } from "./bot/commands/version";
import { screenshot } from "./bot/commands/screenshot";
import { logger } from "./modules/typedLogger";
import { requireAdmin } from "./bot/middlewares/requireAdmin";
import { requireSpecifiedChat } from "./bot/middlewares/requireSpecifiedChat";
import { LarkAdapter } from "./bot/adapters/larkAdapter";

export const global = {
	version: "7.0.0",
};

async function checkAll() {
	logger.info("✓ 开始巡查站点", "APP");
	await axiosCheck();
	await browserCheck();
	logger.ok("△ 检测完成，Sleep.", "APP");
}


// 获取命令行参数
const args = process.argv.slice(2);
// 检查是否包含 -public-mode 标志
const isLocalDebug = args.includes('-public-mode');

console.log(`\n
_____                    _ _ _                     ____ _               _       ____        _   
|_   _| __ __ ___   _____| | (_)_ __   __ _ ___    / ___| |__   ___  ___| | __  | __ )  ___ | |_ 
 | || '__/ _\` \\ \\ / / _ \\ | | | '_ \\ / _\` / __|  | |   | '_ \\ / _ \\/ __| |/ /  |  _ \\ / _ \\| __|
 | || | | (_| |\\ V /  __/ | | | | | | (_| \\__ \\  | |___| | | |  __/ (__|   <   | |_) | (_) | |_ 
 |_||_|  \\__,_| \\_/ \\___|_|_|_|_| |_|\\__, |___/   \\____|_| |_|\\___|\\___|_|\\_\\  |____/ \\___/ \\__|
                                     |___/                                                      

          Copyright © 2020-2024 Travellings Project. All rights reserved.  //  Version ${global.version}
`);
logger.info("尝试连接到数据库...", "APP");
sql
	.sync()
	.then(() => {
		logger.ok("成功连接到数据库 ~", "APP");
	})
	.catch((err) => {
		logger.err((err as Error).message, "APP");
	}); // 数据库同步 + 错误处理

if (isLocalDebug) {
	// 本地 debug 模式 检查完就退出
	logger.info("进入本地开发模式...", "APP")
	process.env["PUBLIC_MODE"] = 'true';
	checkAll();
}else{
	botManager.registerAdapter(new TelegramAdapter());
	botManager.registerAdapter(new LarkAdapter());

	botManager.registerCommand("help", help);
	botManager.registerCommand("version", version);
	botManager.registerCommand("query", requireSpecifiedChat(query));
	botManager.registerCommand("check", requireSpecifiedChat(requireAdmin(check)));
	botManager.registerCommand(
		"screenshot",
		requireSpecifiedChat(requireAdmin(screenshot))
	);

	logger.info("没到点呢，小睡一会 ~", "APP");

	schedule("0 4 * * *", () => {
		checkAll();
	});
}
