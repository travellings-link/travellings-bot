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

export const bot = new Telegraf(config.BOT_TOKEN, {
	telegram: { apiRoot: config.BOT_API },
});

import help from "./commands/help";
import check from "./commands/check";
import query from "./commands/query";
import version from "./commands/version";
import screenshot from "./commands/screenshot";

bot.start((ctx) => ctx.reply("你好！有什么事喵？"));

help(bot);
check(bot);
query(bot);
version(bot);
screenshot(bot);

bot.catch((error, ctx) => {
	console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error));
	ctx.reply("坏掉了喵~ 更多信息可能包含在控制台输出中.");
});
