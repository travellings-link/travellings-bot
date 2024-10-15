import chalk from "chalk";
import { WebModel } from "../../modules/sqlModel";
import { config } from "../../config";
import { Telegraf } from "telegraf";
import { global } from "../../app";

export default (bot: Telegraf) => {
	bot.command("query", async (ctx) => {
		const chatId = ctx.message.chat.id;

		if (!config.ALLOW_CHATID.includes(chatId)) {
			ctx.reply("当前对话不允许使用此命令喵");
			return;
		}

		const args = ctx.message.text.split(" ");
		const input = args[1];

		if (input === undefined || isNaN(parseInt(input))) {
			return ctx.reply("ID 无效，请输入纯数字喵");
		}

		try {
			const result = await WebModel.findByPk(parseInt(input));
			if (result) {
				const { name, link, status, failedReason, tag } = result;
				return ctx.reply(
					`<strong>找到啦 ~</strong>\n\nID：${input}\n名称：${name}\n网址：${link}\n巡查状态：${status}\n失败原因：${failedReason}\nTAG：${tag}`,
					{ link_preview_options: { is_disabled: true }, parse_mode: "HTML" }
				);
			} else {
				return ctx.reply("没找到喵 ~");
			}
		} catch (error) {
			console.log(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, error));
			return ctx.reply("坏掉了喵~ 更多信息可能包含在控制台输出中.");
		}
	});
};
