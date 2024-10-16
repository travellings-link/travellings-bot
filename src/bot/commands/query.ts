import { WebModel } from "../../modules/sqlModel";
import { MessageProcesser } from "bot/adapters/botAdapter";
import { logger } from "modules/typedLogger";

export const query: MessageProcesser = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const input = args[1];

	if (input === undefined || isNaN(parseInt(input))) {
		ctx.reply("ID 无效，请输入纯数字喵");
		return;
	}

	try {
		const result = await WebModel.findByPk(parseInt(input));
		if (result) {
			const { name, link, status, failedReason, tag } = result;
			ctx.replyWithRichText(
				`<strong>找到啦 ~</strong>\n\nID：${input}\n名称：${name}\n网址：${link}\n巡查状态：${status}\n失败原因：${failedReason}\nTAG：${tag}`
			);
			return;
		} else {
			ctx.reply("没找到喵 ~");
			return;
		}
	} catch (error) {
		logger.err((error as Error).message, "BOT");
		ctx.reply("坏掉了喵~ 更多信息可能包含在控制台输出中.");
		return;
	}
};
