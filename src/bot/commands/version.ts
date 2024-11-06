import { global } from "../../app";
import { MessageProcessor } from "../adapters/botAdapter";

export const version: MessageProcessor = async (ctx) => {
	ctx.replyWithRichText([
		[{ type: "text", content: "Travellings Bot", bold: true }],
		[{ type: "text", content: `Version：${global.version}` }],
		[
			{
				type: "link",
				content: "https://github.com/travellings-link/travellings-bot",
				href: "https://github.com/travellings-link/travellings-bot",
			},
		],
	]);
};
