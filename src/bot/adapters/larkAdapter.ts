import * as lark from "@larksuiteoapi/node-sdk";
import {
	BotAdapter,
	Context,
	ErrorProcessor,
	MessageProcessor,
} from "./botAdapter";
import { config } from "../../config";
import { logger } from "../../modules/typedLogger";
import {
	Link,
	RichTextMessage,
	Text as RichText,
} from "bot/utils/richTextMessage";
import path from "path";
import fs from "fs";

export class LarkContext implements Context {
	private readonly client: lark.Client;
	private readonly sender_id: string;
	private readonly chat_id: string;
	private readonly message_id: string;
	private readonly message_text: string;
	constructor(
		client: lark.Client,
		sender_id: string,
		chat_id: string,
		message_id: string,
		message_text: string
	) {
		this.client = client;
		this.sender_id = sender_id;
		this.chat_id = chat_id;
		this.message_id = message_id;
		this.message_text = message_text;
	}
	async isPrivateChat(): Promise<boolean> {
		try {
			const chatInfo = await this.client.im.v1.chat.get({
				path: { chat_id: this.chat_id },
			});
			if (chatInfo.code !== 0) {
				logger.err(`Error fetching chat info: ${chatInfo.msg}`, "LarkBot");
				return false;
			}
			return chatInfo.data?.chat_type === "p2p";
		} catch (error) {
			logger.err(`Failed to determine chat type: ${error}`, "LarkBot");
			return false;
		}
	}
	async getMessageText(): Promise<string> {
		return this.message_text;
	}
	async getChatId(): Promise<string> {
		return this.chat_id;
	}
	async getSenderId(): Promise<string> {
		return this.sender_id;
	}
	async isAdmin(): Promise<boolean> {
		return true;
		// return await this.client.im.v1.chat
		// 	.get({
		// 		path: {
		// 			chat_id: await this.getChatId(),
		// 		},
		// 	})
		// 	.then((ret) => {
		// 		if (ret.code !== 0) {
		// 			logger.err(ret.msg!, "LarkBot");
		// 			return false;
		// 		}
		// 		logger.debug(JSON.stringify(ret), "LarkBot");
		// 		return (
		// 			ret.data?.user_manager_id_list?.includes(this.sender_id) ||
		// 			ret.data?.owner_id === this.sender_id
		// 		);
		// 	});
	}
	async isAllowed(): Promise<boolean> {
		return config.LARK_CHATID.includes(this.chat_id);
	}
	async reply(message: string): Promise<void> {
		await this.client.im.v1.message.reply({
			data: {
				msg_type: "text",
				content: JSON.stringify({
					text: message,
				}),
			},
			path: {
				message_id: this.message_id,
			},
		});
	}
	async replyWithRichText(message: RichTextMessage): Promise<void> {
		const message_obj = {
			zh_cn: {
				content: message.map((para) =>
					para.map((block) => {
						switch (block.type) {
							case "link":
								return {
									tag: "a",
									href: (block as Link).href,
									text: (block as Link).content,
								};
							case "text": {
								const txt = block as RichText;
								const style: string[] = [];
								if (txt.bold) {
									style.push("bold");
								}
								if (txt.italic) {
									style.push("italic");
								}
								if (txt.underline) {
									style.push("underline");
								}
								return {
									tag: "text",
									text: txt.content,
									style,
								};
							}
							default:
								return {
									tag: "text",
									text: "",
								};
						}
					})
				),
			},
		};
		await this.client.im.v1.message.reply({
			data: {
				msg_type: "post",
				content: JSON.stringify(message_obj),
			},
			path: {
				message_id: this.message_id,
			},
		});
	}
	async replyWithPhoto(photo: Buffer): Promise<void> {
		if (!fs.existsSync(config.TMP_PATH)) {
			fs.mkdirSync(config.TMP_PATH);
		}
		if (!fs.existsSync(path.join(config.TMP_PATH, "img"))) {
			fs.mkdirSync(path.join(config.TMP_PATH, "img"));
		}
		fs.writeFileSync(
			path.join(config.TMP_PATH, "img", `${this.message_id}`),
			photo,
			{
				flag: "w+",
			}
		);
		const readStream = fs.createReadStream(
			path.join(config.TMP_PATH, "img", `${this.message_id}`)
		);
		const key = await this.client.im.v1.image
			.create({
				data: {
					image_type: "message",
					image: readStream,
				},
			})
			.then(
				(v) => {
					logger.debug(JSON.stringify(v), "LarkBot");
					return v?.image_key;
				},
				(err) => {
					logger.err(`Upload image failed: ${err}`, "LarkBot");
					return undefined;
				}
			);
		if (key === undefined) {
			this.reply("图片上传失败。");
			return;
		}
		await this.client.im.v1.message.reply({
			data: {
				msg_type: "image",
				content: JSON.stringify({
					image_key: key,
				}),
			},
			path: {
				message_id: this.message_id,
			},
		});
	}
}

export class LarkAdapter implements BotAdapter {
	private readonly client: lark.Client;
	private readonly wsClient: lark.WSClient;
	private commandList: { [key: string]: MessageProcessor } = {};
	constructor() {
		this.client = new lark.Client({
			appId: config.LARK_BOT_APPID,
			appSecret: config.LARK_BOT_SECRET,
			appType: lark.AppType.SelfBuild,
			domain: lark.Domain.Feishu,
		});
		this.wsClient = new lark.WSClient({
			appId: config.LARK_BOT_APPID,
			appSecret: config.LARK_BOT_SECRET,
			domain: lark.Domain.Feishu,
			logger: {
				info(msg) {
					logger.info(msg, "LarkAPI");
				},
				error(msg) {
					logger.err(msg, "LarkAPI");
				},
				warn(msg) {
					logger.warn(msg, "LarkAPI");
				},
				debug(msg) {
					logger.debug(msg, "LarkAPI");
				},
				trace(msg) {
					logger.trace(msg, "LarkAPI");
				},
			},
		});
		const eventDispatcher = new lark.EventDispatcher({
			logger: {
				info(msg) {
					logger.info(msg, "LarkAPI");
				},
				error(msg) {
					logger.err(msg, "LarkAPI");
				},
				warn(msg) {
					logger.warn(msg, "LarkAPI");
				},
				debug(msg) {
					logger.debug(msg, "LarkAPI");
				},
				trace(msg) {
					logger.trace(msg, "LarkAPI");
				},
			},
		}).register({
			"im.message.receive_v1": async (data): Promise<void> => {
				const {
					message: { chat_id, content, message_type, message_id },
					sender: { sender_id },
				} = data;
				if (message_type !== "text") {
					return;
				}
				const txt = (JSON.parse(content).text as string).replace(
					"@_user_1 ",
					""
				);
				const ctx = new LarkContext(
					this.client,
					sender_id!.open_id!,
					chat_id,
					message_id,
					txt
				);
				const command = txt.split(" ")[0]?.replace("/", "");
				if (command === undefined || this.commandList[command] === undefined) {
					ctx.reply("你好！有什么事喵？");
					return;
				}
				await this.commandList[command](ctx);
			},
		});
		this.wsClient.start({
			eventDispatcher,
		});
		this.client.im.v1.chat
			.list({
				params: {
					page_size: 100,
				},
			})
			.then((v) => {
				if (v.code !== 0) {
					logger.err(v.msg!, "LarkBot");
					return;
				}
				logger.info("Lark Chats joined:", "LarkBot");
				logger.info("Chat Name\t\t\tChat ID", "LarkBot");
				v.data!.items!.forEach((i) => {
					logger.info(`${i.name}\t\t\t${i.chat_id}`, "LarkBot");
				});
			});
	}
	onErrorCallback: ErrorProcessor = async (err, ctx) => {
		ctx.reply(err.message);
	};
	async boardcastRichTextMessage(message: RichTextMessage): Promise<void> {
		const message_obj = {
			zh_cn: {
				content: message.map((para) =>
					para.map((block) => {
						switch (block.type) {
							case "link":
								return {
									tag: "a",
									href: (block as Link).href,
									text: (block as Link).content,
								};
							case "text": {
								const txt = block as RichText;
								const style: string[] = [];
								if (txt.bold) {
									style.push("bold");
								}
								if (txt.italic) {
									style.push("italic");
								}
								if (txt.underline) {
									style.push("underline");
								}
								return {
									tag: "text",
									text: txt.content,
									style,
								};
							}
							default:
								return {
									tag: "text",
									text: "",
								};
						}
					})
				),
			},
		};
		await Promise.all(
			config.LARK_CHATID.map((chat) => {
				return this.client.im.v1.message
					.create({
						data: {
							receive_id: chat,
							msg_type: "post",
							content: JSON.stringify(message_obj),
						},
						params: {
							receive_id_type: "chat_id",
						},
					})
					.catch((e) => {
						let msg = "";
						if (e["message"] !== undefined) {
							msg = e.message;
						}
						return {
							code: -114514,
							msg: msg,
						};
					})
					.then((ret) => {
						if (ret.code === 0) {
							logger.debug("Message sent successfully.", "LarkBot");
							return;
						}
						logger.err(
							`Send message failed. Error message: ${ret.msg}`,
							"LarkBot"
						);
					});
			})
		);
	}
	async boardcastMessage(message: string): Promise<void> {
		await Promise.all(
			config.LARK_CHATID.map((chat) => {
				return this.client.im.v1.message
					.create({
						data: {
							receive_id: chat,
							msg_type: "text",
							content: JSON.stringify({
								text: message,
							}),
						},
						params: {
							receive_id_type: "chat_id",
						},
					})
					.catch((e) => {
						let msg = "";
						if (e["message"] !== undefined) {
							msg = e.message;
						}
						return {
							code: -114514,
							msg: msg,
						};
					})
					.then((ret) => {
						if (ret.code === 0) {
							logger.debug("Message sent successfully.", "LarkBot");
							return;
						}
						logger.err(
							`Send message failed. Error message: ${ret.msg}`,
							"LarkBot"
						);
					});
			})
		);
	}
	registerCommand(
		commandName: string,
		onMessageCallback: MessageProcessor
	): void {
		this.commandList[commandName] = onMessageCallback;
	}
	onError(onErrorCallback: ErrorProcessor): void {
		this.onErrorCallback = onErrorCallback;
	}
}
