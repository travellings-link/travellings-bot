import { isUrl } from "../../utils/isUrl";
import { screenshotByID, screenshotByUrl } from "../../methods/screenshot";
import { config } from "../../config";
import { Telegraf } from "telegraf";

export default (bot: Telegraf) => {
	bot.command("screenshot", async (ctx) => {
		const userId = ctx.from.id;
		const chatId = ctx.message.chat.id;
		const args = ctx.message.text.split(" ");
		const input = args[1];

		if (!config.ALLOW_CHATID.includes(chatId)) {
			ctx.reply("当前对话不允许使用此命令喵");
			return;
		}

		const admins = await ctx.getChatAdministrators();

		if (
			admins.some((admin) => admin.user.id === userId) ||
			chatId === -1001980170839
		) {
			if (input === undefined || isNaN(parseInt(input))) {
				if (isUrl(input)) {
					try {
						ctx.reply("正在截图，可能需要亿点点时间...");
						const screenshotBuffer = await screenshotByUrl(input);
						await ctx.replyWithPhoto({ source: screenshotBuffer });
					} catch (error) {
						ctx.reply((error as Error).message);
					}
				} else {
					ctx.reply("诶，你输入的是一个正确的 Url 吗（http / https）");
				}
			} else {
				try {
					ctx.reply("正在截图，可能需要亿点点时间...");
					const screenshotBuffer = await screenshotByID(parseInt(input));
					await ctx.replyWithPhoto({ source: screenshotBuffer });
				} catch (error) {
					ctx.reply((error as Error).message);
				}
			}
		} else {
			ctx.reply("你是谁，不给你用喵");
		}
	});
};
