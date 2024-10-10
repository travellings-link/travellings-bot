import { WebModel } from "../../modules/sqlModel";
import axiosCheck from "../../methods/axios";
import browserCheck from "../../methods/browser";
import { Telegraf } from "telegraf";
import { config } from "../../config";

export default (bot: Telegraf) => {
	bot.command("check", async (ctx) => {
		const userId = ctx.from.id;
		const chatId = ctx.message.chat.id;
		const args = ctx.message.text.split(" ");
		const input = args[1];
		const method = args[2];

		if (!config.ALLOW_CHATID.includes(chatId)) {
			ctx.reply("当前对话不允许使用此命令喵");
			return;
		}

		const admins = await ctx.getChatAdministrators();

		if (admins.some((admin) => admin.user.id === userId)) {
			if (input === undefined || isNaN(parseInt(input))) {
				if (input === "axios") {
					ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
					axiosCheck();
				} else if (input === "browser") {
					ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
					browserCheck();
				} else if (input === "all") {
					ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
					await axiosCheck();
					browserCheck();
				} else {
					ctx.reply("方式无效，当前可选方式：axios, browser 喵");
					return;
				}
			} else {
				const isInputVaild = await WebModel.findByPk(parseInt(input));

				if (isInputVaild) {
					if (method === "axios") {
						ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
						axiosCheck(parseInt(input));
					} else if (method === "browser") {
						ctx.reply("巡查任务已启动，请稍后查看报告捏 ~");
						browserCheck(parseInt(input));
					} else {
						ctx.reply("方式无效，当前可选方式：axios, browser 喵");
						return;
					}
				} else {
					ctx.reply("ID 不存在喵");
				}
			}
		} else {
			ctx.reply("你是谁，不给你用喵");
		}
	});
};
