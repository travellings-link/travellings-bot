import { Telegraf } from "telegraf";
import { global } from "../../app";

export default (bot: Telegraf) => {
	bot.command("version", (ctx) =>
		ctx.reply(
			`
<strong>Travellings Bot</strong>
Version：${global.version}
https://github.com/travellings-link/travellings-bot
`,
			{
				link_preview_options: {
					is_disabled: true,
				},
				parse_mode: "HTML",
			}
		)
	);
};
