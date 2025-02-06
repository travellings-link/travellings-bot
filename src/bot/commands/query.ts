import { WebModel } from "../../modules/sqlModel";
import { logger } from "../../modules/typedLogger";
import { MessageProcessor } from "../adapters/botAdapter";

export const query: MessageProcessor = async (ctx) => {
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
			ctx.replyWithRichText([
				[{ type: "text", content: "找到啦 ~", bold: true }],
				[{ type: "text", content: "" }],
				[{ type: "text", content: `ID：${input}` }],
				[{ type: "text", content: `名称：${name}` }],
				[{ type: "text", content: `网址：${link}` }],
				[{ type: "text", content: `巡查状态：${status}` }],
				[{ type: "text", content: `失败原因：${failedReason}` }],
				[{ type: "text", content: `TAG：${tag}` }],
			]);
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
