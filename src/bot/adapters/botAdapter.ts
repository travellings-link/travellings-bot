import { RichTextMessage } from "bot/utils/richTextMessage";

export type MessageProcessor = (ctx: Context) => Promise<void>;
export type ErrorProcessor = (err: Error, ctx: Context) => Promise<void>;

export interface Context {
	getMessageText(): Promise<string>;
	getChatId(): Promise<string>;
	getSenderId(): Promise<string>;
	isAdmin(): Promise<boolean>;
	isAllowed(): Promise<boolean>;
	isPrivateChat(): Promise<boolean>;
	reply(message: string): Promise<void>;
	replyWithRichText(message: RichTextMessage): Promise<void>;
	replyWithPhoto(photo: Buffer): Promise<void>;
}

export interface BotAdapter {
	boardcastMessage(message: string): Promise<void>;
	boardcastRichTextMessage(message: RichTextMessage): Promise<void>;
	registerCommand(
		commandName: string,
		onMessageCallback: MessageProcessor
	): void;
	onError(onErrorCallback: ErrorProcessor): void;
}