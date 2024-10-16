import { Context } from "bot/adapters/botAdapter";
import { Middleware } from "./botMiddleWare";

export const requireAdmin: Middleware = (next) => {
	return async (ctx: Context) => {
		if (await ctx.isAdmin()) {
			await next(ctx);
		} else {
			await ctx.reply("你是谁，不给你用喵");
		}
	};
};
