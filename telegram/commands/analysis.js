const axios = require("axios");
const { readToken } = require("../../modules/umami");
const chalk = require("chalk");
const dotenv = require('dotenv').config();

const wwwUrl = process.env.UMAMI_API + '/websites/' + process.env.UMAMI_WWW_ID + '/stats?endAt=' + `${Date.now()}` + '&startAt=' + `${Date.now() - 86400000}`;
const listUrl = process.env.UMAMI_API + '/websites/' + process.env.UMAMI_LIST_ID + '/stats?endAt=' + `${Date.now()}` + '&startAt=' + `${Date.now() - 86400000}`;

module.exports = (bot) => {
    bot.command('analysis', async (ctx) => {
        try {
            // 使用 readToken 函数获取 token 数据
            readToken(async (error, token) => {
                if (error) {
                    console.log(chalk.red(`[${global.time()}] [UMAMI] [ERROR]`, '读取 Token 失败：', error));
                    return ctx.reply('获取统计信息时发生错误，请查看日志了解详情');
                }

                try {
                    // 发送 HTTP 请求获取网站统计数据
                    const wwwStatsResponse = await axios.get(wwwUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const listStatsResponse = await axios.get(listUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    // 获取统计数据
                    const wwwStats = wwwStatsResponse.data;
                    const listStats = listStatsResponse.data;

                    // 发送统计数据给用户
                    ctx.reply(`
<strong>开往网站统计数据</strong>\n
在过去 24 小时内，开往官网共收到了来自 <strong>${wwwStats.uniques.value}</strong> 人的 <strong>${wwwStats.pageviews.value}</strong> 次访问
开往列表共收到了来自 <strong>${listStats.uniques.value}</strong> 人的 <strong>${listStats.pageviews.value}</strong> 次访问\n
具体数据详见 Umami`, { parse_mode: 'HTML' });
                } catch (error) {
                    console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error));
                    return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
                }
            });
        } catch (error) {
            console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error));
            return ctx.reply('坏掉了喵~ 更多信息可能包含在控制台输出中.');
        }
    });
}
