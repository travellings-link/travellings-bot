import {
	BotAdapter,
	ErrorProcessor,
	MessageProcessor,
} from "./adapters/botAdapter";

class BotManager implements BotAdapter {
	private adapters: BotAdapter[] = [];
	registerAdapter(adapter: BotAdapter) {
		this.adapters.push(adapter);
	}
	registerCommand(
		commandName: string,
		onMessageCallback: MessageProcessor
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
			})
		);
	}
}

export const botManager = new BotManager();
