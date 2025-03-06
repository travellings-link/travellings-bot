import { botManager } from "../bot/botManager";
import { RichTextMessage } from "../bot/utils/richTextMessage";
import { time } from "./time";

/*
 * 存储从 WAIT 状态变成 RUN 状态的站点 id
 */
export class WaitToRunMessageQueue {
	private static instance: WaitToRunMessageQueue; // 单例模式
	private ids: number[] = []; // 存储 ID 的队列

	private constructor() {}

	/**
	 * 获取单例实例
	 *
	 * @returns {WaitToRunMessageQueue} - WaitToRunMessageQueue 实例
	 */
	public static getInstance(): WaitToRunMessageQueue {
		if (!WaitToRunMessageQueue.instance) {
			WaitToRunMessageQueue.instance = new WaitToRunMessageQueue();
		}
		return WaitToRunMessageQueue.instance;
	}

	/**
	 * 往队列插入 id
	 *
	 * @param id - 站点 id
	 * @returns {void}
	 */
	public enqueue(id: number): void {
		this.ids.push(id);
	}

	/**
	 * 读取队列最先插入的 id 并移除
	 *
	 * @returns {number | undefined} - 站点 id
	 */
	public dequeue(): number | undefined {
		return this.ids.shift();
	}

	/**
	 * 获取队列长度
	 *
	 * @returns {number} - 队列长度
	 */
	public size(): number {
		return this.ids.length;
	}

	/**
	 * 检查队列是否为空
	 *
	 * @returns {boolean} - 为空则返回 true，不为空返回 false
	 */
	public isEmpty(): boolean {
		return this.size() === 0;
	}

	/**
	 * 获取队列所有 ID 的副本
	 *
	 * @returns {number[]}
	 */
	public getAllIds(): number[] {
		return [...this.ids];
	}

	/**
	 * 清空队列并发送消息到 bot
	 *
	 * @returns {void}
	 */
	public clearAndNotify(): void {
		if (this.isEmpty()) {
			return;
		}

		const message: RichTextMessage = [
			[
				{
					type: "text",
					bold: true,
					content: "开往巡查姬提醒您：",
				},
			],
		];
		message.push([
			{
				type: "text",
				content:
					"以下的站点从 WAIT 恢复到 RUN 状态，请及时处理对应 issue",
			},
		]);
		while (!this.isEmpty()) {
			message.push([
				{
					type: "text",
					content: `${this.dequeue()}`,
				},
			]);
		}
		message.push(
			[{ type: "text", content: "" }],
			[
				{
					type: "text",
					content: `发送时间：${time()} CST`,
				},
			],
		);
		botManager.boardcastRichTextMessage(message);
	}
}
