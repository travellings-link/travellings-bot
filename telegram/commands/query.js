const chalk = require("chalk");
const dotenv = require('dotenv').config()
const {webModel} = require("../../modules/sqlModel");

const allowed = process.env.ALLOW_CHATID.split(',').map(id => parseInt(id));

module.exports = (bot) => {
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
};