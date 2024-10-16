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
import { botManager } from "bot/botManager";
import { TelegramAdapter } from "bot/adapters/telegramAdapter";
import { help } from "bot/commands/help";
import { check } from "bot/commands/check";
import { query } from "bot/commands/query";
import { version } from "bot/commands/version";
import { screenshot } from "bot/commands/screenshot";
import { logger } from "modules/typedLogger";

export const global = {
	version: "7.0.0",
};

async function checkAll() {
	logger.info("✓ 开始巡查站点", "APP");
	await axiosCheck();
	await browserCheck();
	logger.ok("△ 检测完成，Sleep.", "APP");
}

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

botManager.registerAdapter(new TelegramAdapter());

botManager.registerCommand("help", help);
botManager.registerCommand("check", check);
botManager.registerCommand("query", query);
botManager.registerCommand("version", version);
botManager.registerCommand("screenshot", screenshot);

logger.info("没到点呢，小睡一会 ~", "APP");

schedule("0 4 * * *", () => {
	checkAll();
});
