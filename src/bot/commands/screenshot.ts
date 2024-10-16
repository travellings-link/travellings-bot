import { isUrl } from "../../utils/isUrl";
import { screenshotByID, screenshotByUrl } from "../../methods/screenshot";
import { MessageProcessor } from "bot/adapters/botAdapter";

export const screenshot: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const input = args[1];

	if (input === undefined || isNaN(parseInt(input))) {
		if (isUrl(input)) {
			try {
				ctx.reply("正在截图，可能需要亿点点时间...");
				const screenshotBuffer = await screenshotByUrl(input);
				await ctx.replyWithPhoto(screenshotBuffer);
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
			await ctx.replyWithPhoto(screenshotBuffer);
		} catch (error) {
			ctx.reply((error as Error).message);
		}
	}
};
