import { Context } from "bot/adapters/botAdapter";
import { Middleware } from "./botMiddleWare";

export const requireSpecifiedChat: Middleware = (next) => {
	return async (ctx: Context) => {
		if (await ctx.isAllowed()) {
			await next(ctx);
		} else {
			await ctx.reply("当前对话不允许使用此命令喵");
		}
	};
};
