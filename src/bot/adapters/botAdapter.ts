export type MessageProcessor = (ctx: Context) => Promise<void>;
export type ErrorProcessor = (err: Error, ctx: Context) => Promise<void>;

export interface Context {
	getMessageText(): Promise<string>;
	getChatId(): Promise<number>;
	getSenderId(): Promise<number>;
	isAdmin(): Promise<boolean>;
	isAllowed(): Promise<boolean>;
	reply(message: string): Promise<void>;
	replyWithRichText(message: string): Promise<void>;
	replyWithPhoto(photo: Buffer): Promise<void>;
}

export interface BotAdapter {
	boardcastMessage(message: string): Promise<void>;
	registerCommand(
		commandName: string,
		onMessageCallback: MessageProcessor
	): void;
	onError(onErrorCallback: ErrorProcessor): void;
}
