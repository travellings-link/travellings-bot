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
const axiosCheck = require('./../methods/axios');
const browserCheck = require('./../methods/browser');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN, { telegram: { apiRoot: process.env.BOT_API } });
const allowed = process.env.ALLOW_CHATID.split(',').map(id => parseInt(id));

bot.start((ctx) => ctx.reply('你好！有什么事喵？'));
bot.command('help', (ctx) => ctx.reply(`
<strong>帮助菜单</strong>\n
<strong>路人</strong>
/start - 开始
/help - 帮助
/query :ID - 查询站点\n
<strong>管理</strong>
/check :ID :Method
`, { parse_mode: 'HTML' }));

bot.command('version', (ctx) => ctx.reply(`
<strong>Travellings Bot</strong>
Version：${global.version}
https://github.com/travellings-link/travellings-bot
`, { disable_web_page_preview: true, parse_mode: 'HTML' }));

function analysisReply() {
  // 这次也不需要在外面调用这些变量，干脆都弄成let
  let apiBaseUrl = process.env.UMAMI_API;
  // 首先先求 token
  // https://umami.is/docs/authentication
  let authenticationUrl = apiBaseUrl + "/auth/login";
  axios.post(authenticationUrl, {
    "username": process.env.UMAMI_USERNAME,
    "password": process.env.UMAMI_PASSWORD
  })
  .then((response) => {global['umamiToken'] = JSON.parse(response.data)['token'];});
  const currentTimestamp = Date.now();
  const oneDayBefore = currentTimestamp - 86400000;
  // 给 token 提前弄好格式
  // https://umami.is/docs/website-stats
  let requestToken = 'Bearer ' + umamiToken;
  global['stats'] = [];
  function getStats(siteId) {
    let requestUrl = apiBaseUrl + '/api/websites/' + siteId + '/stats?endAt=' + currentTimestamp + '&startAt=' + oneDayBefore;
    axios.get(requestUrl, {headers: {"Authorization": requestToken}})
    .then((response) => {stats.push(JSON.parse(response.data));})
  }
  getStats(process.env.UMAMI_LIST_ID);
  getStats(process.env.UMAMI_WWW_ID);
}

bot.command('analysis', (ctx) => {
  try{
    analysisReply();
    return ctx.reply(`
<strong>开往网站统计数据（最近 24 小时）</strong>\n
在过去 24 小时内，开往官网共收到了来自 ${stats[0]['uniques']['value']} 人的 ${stats[0]['pageviews']['value']} 次访问，开往列表共收到了来自 ${stats[1]['uniques']['value']} 人的 ${stats[1]['pageviews']['value']} 次访问。具体数据详见 Umami。`)
  } catch (error) {
    console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error))
    return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
  }
}
)

bot.command('query', async (ctx) => {
  const chatId = ctx.message.chat.id;

  if (!allowed.includes(chatId)) {
    return ctx.reply('当前对话不允许使用此命令喵');
  }
  
  const args = ctx.message.text.split(' ');
  const input = args[1];

  if (isNaN(input)) {
    return ctx.reply('ID 无效，请输入纯数字喵')
  }

  try {
    const result = await webModel.findByPk(input);
    if (result) {
      const { name, link, status, failedReason, tag } = result;
      return ctx.reply(`<strong>找到啦 ~</strong>\n\nID：${input}\n名称：${name}\n网址：${link}\n巡查状态：${status}\n失败原因：${failedReason}\nTAG：${tag}`, { disable_web_page_preview: true, parse_mode: 'HTML' });
    } else {
      return ctx.reply('没找到喵 ~');
    }
  } catch (error) {
    console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error))
    return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
  }
});

bot.command('check', async (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.message.chat.id;
  const args = ctx.message.text.split(' ');
  const input = args[1];
  const method = args[2];

  if (!allowed.includes(chatId)) {
    return ctx.reply('当前对话不允许使用此命令喵');
  }

  const admins = await ctx.getChatAdministrators(chatId);

  if (admins.some(admin => admin.user.id === userId)) {
    if (isNaN(input)) {
      if (input.toString() === 'axios') {
        ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
        axiosCheck();
      } else if (input.toString() === 'browser') {
        ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
        browserCheck();
      } else {
        return ctx.reply("方式无效，当前可选方式：axios, browser 喵");
      }
    } else {
      const isInputVaild = await webModel.findByPk(input);

      if (isInputVaild) {
        if (method.toString() === 'axios') {
          ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
          axiosCheck(input);
        } else if (method.toString() === 'browser') {
          ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
          browserCheck(input);
        } else {
          return ctx.reply("方式无效，当前可选方式：axios, browser 喵");
        }
      } else {
        ctx.reply("ID 不存在喵")
      }

    }
  } else {
    ctx.reply('你是谁，不给你用喵');
  }

});

bot.catch((error, ctx) => {
  console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error))
  return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
});

module.exports = { bot };