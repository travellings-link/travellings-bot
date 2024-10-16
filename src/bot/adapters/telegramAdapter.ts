import { Telegraf, Context as TgContext } from "telegraf";
import {
	BotAdapter,
	Context,
	ErrorProcessor,
	MessageProcessor,
} from "./botAdapter";
import { config } from "../../config";
import { logger } from "modules/typedLogger";

export class TelegramContext implements Context {
	private readonly ctx: TgContext;
	constructor(ctx: TgContext) {
		this.ctx = ctx;
	}

	async getMessageText(): Promise<string> {
		if (this.ctx.text === undefined) {
			throw new Error("No text message contained in context.");
		}
		return this.ctx.text;
	}
	async getChatId(): Promise<number> {
		if (this.ctx.chat === undefined) {
			throw new Error("Cannot get ChatID in a non-chat context.");
		}
		return this.ctx.chat.id;
	}
	async getSenderId(): Promise<number> {
		if (this.ctx.message === undefined) {
			throw new Error("Cannot get SenderID without message.");
		}
		return this.ctx.message.from.id;
	}
	async isAdmin(): Promise<boolean> {
		const sender = await this.getSenderId();
		const admins = await this.ctx.getChatAdministrators();
		return admins.some((u) => u.user.id === sender);
	}
	async isAllowed(): Promise<boolean> {
		const chatId = await this.getChatId();
		return config.ALLOW_CHATID.includes(chatId);
	}
	async reply(message: string): Promise<void> {
		this.ctx.reply(message);
	}
	async replyWithRichText(message: string): Promise<void> {
		this.ctx.reply(message, {
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
		});
	}
	async replyWithPhoto(photo: Buffer): Promise<void> {
		this.ctx.replyWithPhoto({ source: photo });
	}
}

export class TelegramAdapter implements BotAdapter {
	readonly bot: Telegraf;
	onErrorCallback: ErrorProcessor = async (err, ctx) => {
		ctx.reply(err.message);
	};
	onError(onErrorCallback: ErrorProcessor): void {
		this.onErrorCallback = onErrorCallback;
	}
	constructor() {
		this.bot = new Telegraf(config.BOT_TOKEN, {
			telegram: { apiRoot: config.BOT_API },
		});
		this.bot
			.launch()
			.then(() => {
				logger.ok("Telegram Bot 已启动 ~", "TBOT");
			})
			.catch((err) => {
				logger.err(err, "TBOT");
			});
		this.bot.start((ctx) => ctx.reply("你好！有什么事喵？"));
		this.bot.catch((err, ctx) => {
			logger.err((err as Error).message, "TBOT");
			this.onErrorCallback(err as Error, new TelegramContext(ctx));
		});
	}
	registerCommand(
		commandName: string,
		onMessageCallback: MessageProcessor
	): void {
		this.bot.command(commandName, (ctx) => {
			const c = new TelegramContext(ctx);
			onMessageCallback(c);
		});
	}

	async boardcastMessage(message: string): Promise<void> {
		try {
			await this.bot.telegram.sendMessage(config.BOT_CHATID, message, {
				parse_mode: "HTML",
			});
		} catch (error) {
			logger.err((error as Error).message, "TBOT");
		}
	}
}
