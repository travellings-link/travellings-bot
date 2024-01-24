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
const dotenv = require('dotenv').config();
const { webModel } = require('./sqlModel');

const bot = new Telegraf(process.env.BOT_TOKEN, { telegram: { apiRoot: process.env.BOT_API } });
const allowed = process.env.ALLOW_CHATID.split(',').map(id => parseInt(id));
const admin = process.env.ADMIN_ID.split(',').map(id => parseInt(id));

async function sendMessage(message) {
  try {
    await bot.telegram.sendMessage(process.env.BOT_CHATID, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error.message))
  }
}

bot.start((ctx) => ctx.reply('你好！有什么事喵？'));
bot.command('help', (ctx) => ctx.reply(`
**帮助菜单**\n
（路人）
/start - 开始
/help - 帮助
/query <ID> - 查询站点
`, { parse_mode: 'markdown' }));

bot.command('version', (ctx) => ctx.reply(`
**Travellings Bot**
Version：${global.version}
https://github.com/travellings-link/travellings-bot
`, { disable_web_page_preview: true, parse_mode: 'markdown' }));

bot.command('query', async (ctx) => {
  const chatId = ctx.from.id;

  if (!allowed.includes(chatId)) {
    return ctx.reply('你是谁？不给用喵 ~');
  }
  
  const args = ctx.message.text.split(' ');
  const input= args[1];

  if (isNaN(input)) {
    return ctx.reply('ID 无效，请输入纯数字喵')
  }

  try {
    const result = await webModel.findByPk(input);
    if (result) {
      const { name, link, status, failedReason, tag } = result;
      return ctx.reply(`**找到啦 ~**\n\nID：${input}\n名称：${name}\n网址：${link}\n巡查状态：${status}\n失败原因：${failedReason}\nTAG：${tag}`, { disable_web_page_preview: true, parse_mode: 'markdown' });
    } else {
      return ctx.reply('没找到喵 ~');
    }
  } catch (error) {
    console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error.message))
    return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
  }
});


module.exports = { sendMessage };
module.exports = bot;