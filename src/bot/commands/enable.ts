import { config } from "../../config";
import { MessageProcessor } from "../adapters/botAdapter";

export const enable: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const bot_id = args[1];
	const system_id = args[2];
	const system_id_error_message =
		"请输入一个有效的 SYSTEM_ID; 目前可选值: command, task";
	if (bot_id === undefined) {
		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: `请输入一个有效的 BOT_ID`,
				},
			],
		]);
		return;
	}
	if (system_id === undefined) {
		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: system_id_error_message,
				},
			],
		]);
		return;
	}
	if (bot_id !== config["BOT_ID"]) {
		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: `本机 ID 为 ${config.BOT_ID}，不响应状态调整`,
				},
			],
		]);
		return;
	}
	if (system_id === "command") {
		config.COMMAND_ENABLE = true;
		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: `ID 为 ${config.BOT_ID} 的巡查机已启用指令系统`,
				},
			],
		]);
		return;
	} else if (system_id === "task") {
		config.SCHEDULE_TASK_ENABLE = true;
		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: `ID 为 ${config.BOT_ID} 的巡查机已启用定时巡查系统`,
				},
			],
		]);
		return;
	} else {
		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: system_id_error_message,
				},
			],
		]);
		return;
	}
};
