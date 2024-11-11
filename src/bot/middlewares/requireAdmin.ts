import { Context } from "../adapters/botAdapter";
import { Middleware } from "./botMiddleWare";
import { config } from '../../config';

export const requireAdmin: Middleware = (next) => {
	return async (ctx: Context) => {
		if (await ctx.isPrivateChat()) {
			await next(ctx);
			return;
		}

		const chatId = await ctx.getChatId();
		const botLogChat = config.TG_BOT_CHATID as unknown as string;

		if (chatId !== botLogChat || await ctx.isAdmin()) {
			await next(ctx);
		} else {
			await ctx.reply("你是谁，不给你用喵");
		}
	};
};