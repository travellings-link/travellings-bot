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

const chalk = require('chalk');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN, { telegram: { apiRoot: process.env.BOT_API } });

const help = require('./commands/help');
const check = require('./commands/check');
const query = require('./commands/query');
const version = require('./commands/version');

bot.start((ctx) => ctx.reply('你好！有什么事喵？'));

help(bot);
check(bot);
query(bot);
version(bot);
analysis(bot);

bot.catch((error, ctx) => {
  console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error))
  return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
});

module.exports = { bot };