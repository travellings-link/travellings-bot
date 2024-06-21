const dotenv = require('dotenv').config()
const {webModel} = require("../../modules/sqlModel");
const axiosCheck = require('../../methods/axios');
const browserCheck = require('../../methods/browser');

const allowed = process.env.ALLOW_CHATID.split(',').map(id => parseInt(id));

module.exports = (bot) => {
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
                } else if (input.toString() === 'all') {
                    ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
                    await axiosCheck();
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
};