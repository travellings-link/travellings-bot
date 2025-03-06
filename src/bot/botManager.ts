import { config } from "../config";
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
		let wrappedCallback: MessageProcessor;
		// 列表内指令是白名单，不论指令系统是否禁用都可使用
		if (["echo", "enable"].includes(commandName)) {
			wrappedCallback = onMessageCallback;
		} else {
			wrappedCallback = async (message) => {
				// 检查是否禁用指令系统
				if (config.COMMAND_ENABLE === false) {
					this.boardcastRichTextMessage([
						[
							{
								type: "text",
								bold: true,
								content: "本机未启用指令系统",
							},
						],
						[{ type: "text", content: "" }],
						[
							{
								type: "text",
								content:
									"/enable :BOT_ID command - 来启用这台巡查机的指令系统",
							},
						],
						[
							{
								type: "text",
								content: "/echo - 查看相关信息",
							},
						],
					]);
					return;
				}

				await onMessageCallback(message);
			};
		}

		// 注册指令
		this.adapters.forEach((a) => {
			a.registerCommand(commandName, wrappedCallback);
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
