import { MessageProcessor } from "../adapters/botAdapter";

export const help: MessageProcessor = async (ctx) => {
	ctx.replyWithRichText([
		[{ type: "text", content: "帮助菜单", bold: true }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "路人", bold: true }],
		[{ type: "text", content: "/start - 开始" }],
		[{ type: "text", content: "/help - 帮助" }],
		[{ type: "text", content: "/query :ID - 查询站点" }],
		[{ type: "text", content: "/echo - 检查巡查机是否存活" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "管理", bold: true }],
		[{ type: "text", content: "/check :ID :Method" }],
		[{ type: "text", content: "/screenshot :ID / :Url - 对一个站点截图" }],
		[
			{
				type: "text",
				content: "/enable :BOT_ID :SYSTEM_ID - 启用指定巡查机的某系统",
			},
		],
		[
			{
				type: "text",
				content: "/disable :BOT_ID :SYSTEM_ID - 禁用指定巡查机的某系统",
			},
		],
	]);
};
