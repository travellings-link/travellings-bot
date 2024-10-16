export type MessageProcesser = (ctx: Context) => Promise<void>;
export type ErrorProcesser = (err: Error, ctx: Context) => Promise<void>;

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
		onMessageCallback: MessageProcesser
	): void;
	onError(onErrorCallback: ErrorProcesser): void;
}
