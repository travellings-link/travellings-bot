import { config } from "../../config";
import { time } from "../../modules/typedLogger";
import { MessageProcessor } from "../adapters/botAdapter";

export const echo: MessageProcessor = async (ctx) => {
	ctx.replyWithRichText([
		[{ type: "text", content: `Bot ID: ${config.BOT_ID}`, bold: true }],
		[
			{
				type: "text",
				content: `运行状态: ${config.ENABLE ? "运行中" : "未运行"}`,
			},
		],
		[
			{
				type: "text",
				content: `Commit Hash: ${config.COMMIT_HASH}`,
			},
		],
		[
			{
				type: "text",
				content: `发送时间：${time()} CST`,
			},
		],
	]);
};
