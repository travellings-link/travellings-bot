import { global } from "../../app";
import { MessageProcesser } from "bot/adapters/botAdapter";

export const version: MessageProcesser = async (ctx) => {
	ctx.replyWithRichText(
		`
	<strong>Travellings Bot</strong>
	Version：${global.version}
	https://github.com/travellings-link/travellings-bot
	`
	);
};
