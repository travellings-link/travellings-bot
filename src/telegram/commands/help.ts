import { Telegraf } from "telegraf";

export default (bot: Telegraf) => {
	bot.command("help", (ctx) =>
		ctx.reply(
			`
<strong>帮助菜单</strong>\n
<strong>路人</strong>
/start - 开始
/help - 帮助
/query :ID - 查询站点\n
<strong>管理</strong>
/check :ID :Method
/screenshot :ID / :Url - 对一个站点截图
`,
			{ parse_mode: "HTML" }
		)
	);
};
