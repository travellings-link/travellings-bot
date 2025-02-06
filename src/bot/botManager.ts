import {
	BotAdapter,
	ErrorProcessor,
	MessageProcessor,
} from "./adapters/botAdapter";
import { RichTextMessage } from "./utils/richTextMessage";

class BotManager implements BotAdapter {
	async boardcastRichTextMessage(message: RichTextMessage): Promise<void> {
		await Promise.all(
			this.adapters.map((a) => {
				return a.boardcastRichTextMessage(message);
			}),
		);
	}
	private adapters: BotAdapter[] = [];
	registerAdapter(adapter: BotAdapter) {
		this.adapters.push(adapter);
	}
	registerCommand(
		commandName: string,
		onMessageCallback: MessageProcessor,
	): void {
		this.adapters.forEach((a) => {
			a.registerCommand(commandName, onMessageCallback);
		});
	}
	onError(onErrorCallback: ErrorProcessor): void {
		this.adapters.forEach((a) => {
			a.onError(onErrorCallback);
		});
	}
	async boardcastMessage(message: string): Promise<void> {
		await Promise.all(
			this.adapters.map((a) => {
				return a.boardcastMessage(message);
			}),
		);
	}
}

export const botManager = new BotManager();
