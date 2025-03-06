/**
 * 一个池，用于调用异步函数，并且限制并发数
 *
 * @param concurrentLimit 并发数限制
 * @param inputValues 输入值数组
 * @param iteratorFn 异步函数
 * @returns
 */
export async function asyncPool<T>(
	concurrentLimit: number,
	inputValues: T[],
	iteratorFn: (inputValue: T) => Promise<void>,
) {
	let i = 0; // 将要处理的 Promise 的数组索引
	const allPromise: Promise<void>[] = []; // 存储所有 Promise 的数组
	const queueOfExecuting: Promise<void>[] = []; // 存储当前正在执行的 Promise 的数组

	const enqueue = function (): Promise<void> {
		// 边界处理，如果数组已经遍历完，返回一个已解决的 Promise
		if (i === inputValues.length) {
			return Promise.resolve();
		}

		// 初始化 Promise
		// 从数组中取出一个元素，
		const item = inputValues[i++] as T; // 上面边界处理过了，所以必然返回 T

		// 并调用 iteratorFn 处理该元素，返回一个 Promise
		const promise = Promise.resolve().then(() => iteratorFn(item));

		// 将这个 Promise 添加到 allPromise 数组中
		allPromise.push(promise);

		// 用这个 Promise 创建一个 executingPromise
		// 当这个 Promise 执行完毕时，把 executingPromise 从 queueOfExecuting 数组中删除
		const executingPromise: Promise<void> = promise.then(() =>
			queueOfExecuting.splice(
				queueOfExecuting.indexOf(executingPromise),
				1,
			),
		) as Promise<void>; // 数组里不会有重复的，所以 as Promise<void>

		// 将 Promise 添加到 queueOfExecuting 数组中
		queueOfExecuting.push(executingPromise);

		// 如果 queueOfExecuting 数组中的 Promise 数量达到 concurrentLimit
		// 使用 Promise.race 等待其中一个 Promise 完成
		let ret: Promise<void> = Promise.resolve();
		if (queueOfExecuting.length >= concurrentLimit) {
			ret = Promise.race(queueOfExecuting);
		}

		// 递归调用 enqueue，直到遍历完数组中的所有元素
		return ret.then(() => enqueue());
	};
	// 等待 allPromise 数组中所有 Promise 完成
	return enqueue().then(() => Promise.all(allPromise));
}
