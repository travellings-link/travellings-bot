import { global } from "../../app";
import { MessageProcessor } from "../adapters/botAdapter";

export const version: MessageProcessor = async (ctx) => {
	ctx.replyWithRichText(
		`
	<strong>Travellings Bot</strong>
	Version：${global.version}
	https://github.com/travellings-link/travellings-bot
	`
	);
};
