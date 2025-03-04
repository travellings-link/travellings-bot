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
}
