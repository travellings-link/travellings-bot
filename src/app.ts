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

import chalk from "chalk";
import { schedule } from "node-cron";
import moment from "moment-timezone";
import sql from "./modules/sqlConfig";
// import { bot } from "./telegram/bot";
import axiosCheck from "./methods/axios";
import browserCheck from "./methods/browser";
import { botManager } from "bot/botManager";
import { TelegramAdapter } from "bot/adapters/telegramAdapter";
import { help } from "bot/commands/help";
import { check } from "bot/commands/check";
import { query } from "bot/commands/query";
import { version } from "bot/commands/version";
import { screenshot } from "bot/commands/screenshot";

export const global = {
	version: "6.0.0",
	time: function () {
		return moment().tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss");
	},
};

async function checkAll() {
	await console.log(
		chalk.green(`[${global.time()}] [APP] [INFO] ✓ 开始巡查站点`)
	);
	await axiosCheck();
	await browserCheck();
	console.log(
		chalk.green(`[${global.time()}] [APP] [INFO] △ 检测完成，Sleep.`)
	);
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
console.log(chalk.cyan(`[${global.time()}] [APP] [INFO] 尝试连接到数据库...`));
sql
	.sync()
	.then(() => {
		console.log(
			chalk.green(`[${global.time()}] [APP] [OK] 成功连接到数据库 ~`)
		);
	})
	.catch((err) =>
		console.log(chalk.red(`[${global.time()}] [APP] [ERROR]`, err))
	); // 数据库同步 + 错误处理
// bot
// 	.launch()
// 	.then(() => {
// 		console.log(
// 			chalk.green(`[${global.time()}] [TBOT] [OK] Telegram Bot 已启动 ~`)
// 		);
// 	})
// 	.catch((err) =>
// 		console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, err))
// 	);

botManager.registerAdapter(new TelegramAdapter());

botManager.registerCommand("help", help);
botManager.registerCommand("check", check);
botManager.registerCommand("query", query);
botManager.registerCommand("version", version);
botManager.registerCommand("screenshot", screenshot);

console.log(chalk.cyan(`[${global.time()}] [APP] [INFO] 没到点呢，小睡一会 ~`));

schedule("0 4 * * *", () => {
	checkAll();
});
