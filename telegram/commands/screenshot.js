const dotenv = require('dotenv').config()
const { isUrl } = require('../../utils/isUrl');
const { screenshotByID, screenshotByUrl } = require('../../methods/screenshot');

const allowed = process.env.ALLOW_CHATID.split(',').map(id => parseInt(id));

module.exports = (bot) => {
    bot.command('screenshot', async (ctx) => {
        const userId = ctx.from.id;
        const chatId = ctx.message.chat.id;
        const args = ctx.message.text.split(' ');
        const input = args[1];

        if (!allowed.includes(chatId)) {
            return ctx.reply('当前对话不允许使用此命令喵');
        }

        const admins = await ctx.getChatAdministrators(chatId);

        if (admins.some(admin => admin.user.id === userId) || chatId === -1001980170839) {
            if (isNaN(input)) {
                if (isUrl(input)) {
                    try {
                        ctx.reply('正在截图，可能需要亿点点时间...');
                        const screenshotBuffer = await screenshotByUrl(input);
                        await ctx.replyWithPhoto({ source: screenshotBuffer });
    
                    } catch (error) {
                        ctx.reply(error.message);
                    }
                } else {
                    ctx.reply("诶，你输入的是一个正确的 Url 吗（http / https）")
                }
            } else {
                try {
                    ctx.reply('正在截图，可能需要亿点点时间...');
                    const screenshotBuffer = await screenshotByID(input);
                    await ctx.replyWithPhoto({ source: screenshotBuffer });

                } catch (error) {
                    ctx.reply(error.message);
                }
            }
        } else {
            ctx.reply('你是谁，不给你用喵');
        }

    });
};