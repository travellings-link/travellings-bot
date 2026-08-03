import { MessageProcessor } from "../adapters/botAdapter";

export const help: MessageProcessor = async (ctx) => {
	ctx.replyWithRichText([
		[{ type: "text", content: "帮助菜单", bold: true }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "路人", bold: true }],
		[{ type: "text", content: "/start - 开始" }],
		[{ type: "text", content: "/help - 帮助" }],
		[{ type: "text", content: "/query :ID - 查询站点" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "管理", bold: true }],
		[{ type: "text", content: "/check :ID :Method" }],
		[{ type: "text", content: "/screenshot :ID / :Url - 对一个站点截图" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: "回收站", bold: true }],
		[{ type: "text", content: "/archives [页码] - 查看回收站" }],
		[{ type: "text", content: "/archive_statuses - 查看归档状态统计" }],
		[{ type: "text", content: "/restore <ID> - 恢复归档站点" }],
		[{ type: "text", content: "/delete_archive <ID> - 删除归档" }],
		[
			{
				type: "text",
				content: "/delete_archive_by_status <状态> - 按状态批量删除",
			},
		],
		[
			{
				type: "text",
				content: "  示例: /delete_archive_by_status 404",
			},
		],
		[
			{
				type: "text",
				content: "  常见状态: LOST, ERROR, TIMEOUT, 404, 500, 502",
			},
		],
		[{ type: "text", content: "/clear_archives - 清空回收站" }],
		[{ type: "text", content: "/archive_now - 立即执行归档巡查" }],
	]);
};
