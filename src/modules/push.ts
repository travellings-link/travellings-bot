//  _____    _                                  ____            _
// |_   _|__| | ___  __ _ _ __ __ _ _ __ ___   |  _ \ _   _ ___| |__
//   | |/ _ \ |/ _ \/ _` | '__/ _` | '_ ` _ \  | |_) | | | / __| '_ \
//   | |  __/ |  __/ (_| | | | (_| | | | | | | |  __/| |_| \__ \ | | |
//   |_|\___|_|\___|\__, |_|  \__,_|_| |_| |_| |_|    \__,_|___/_| |_|
//                  |___/
//
// Telegram Notify Push Util
// By BLxcwg666 <huixcwg@gmail.com>
// 2024/01/16 04:38 CST

import chalk from "chalk";
import { config } from "../config";
import { Telegraf } from "telegraf";
import { global } from "../app";

const bot = new Telegraf(config.BOT_TOKEN, {
	telegram: { apiRoot: config.BOT_API },
});

export async function sendMessage(message: string) {
	try {
		await bot.telegram.sendMessage(config.BOT_CHATID, message, {
			parse_mode: "HTML",
		});
	} catch (error) {
		console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error));
	}
}
