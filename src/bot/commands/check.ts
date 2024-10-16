import { MessageProcessor } from "../adapters/botAdapter";
import { WebModel } from "../../modules/sqlModel";
import axiosCheck from "../../methods/axios";
import browserCheck from "../../methods/browser";

export const check: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const input = args[1];
	const method = args[2];
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
};
