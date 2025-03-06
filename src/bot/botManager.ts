import {
	BotAdapter,
	ErrorProcessor,
	MessageProcessor,
} from "./adapters/botAdapter";
import { RichTextMessage } from "./utils/richTextMessage";

class BotManager implements BotAdapter {
	private adapters: BotAdapter[] = [];

	async boardcastRichTextMessage(message: RichTextMessage): Promise<void> {
		// 避免在无 Token 模式下尝试发送信息
		if (process.env["NO_TOKEN_MODE"] === "true") {
			return;
		}

		await Promise.all(
			this.adapters.map((a) => {
				return a.boardcastRichTextMessage(message);
			}),
		);
	}
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
		// 避免在无 Token 模式下尝试发送信息
		if (process.env["NO_TOKEN_MODE"] === "true") {
			return;
		}

		await Promise.all(
			this.adapters.map((a) => {
				return a.boardcastMessage(message);
			}),
		);
	}
}

export const botManager = new BotManager();
