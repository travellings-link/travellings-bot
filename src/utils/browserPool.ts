import fs from "fs";
import path from "path";
import { Browser, Page, connect, launch } from "puppeteer";

import { config } from "../config";
import { logger } from "../modules/typedLogger";
import { delay } from "./time";

type OkOrValue<T> =
	| { ok: false; code?: number; error?: unknown }
	| { ok: true; value: T };

class BrowserPool {
	private pool: string[] = [];
	private addBrowser(browserWsEndpoint: string) {
		this.pool.push(browserWsEndpoint);
	}
	public async work<PayloadType extends { url: string }, ReturnType>(
		payloads: PayloadType[],
		worker: (payload: PayloadType, page: Page) => Promise<ReturnType>,
	): Promise<OkOrValue<ReturnType>[]> {
		const actualWorker = async (
			payload: PayloadType,
			browser: Browser,
		): Promise<OkOrValue<ReturnType>> => {
			const page = await browser.newPage();
			await page.setViewport({ width: 1920, height: 1080 });
			await page.setExtraHTTPHeaders({
				referer: "https://www.travellings.cn/go.html", // 来自开往的 Referer
			});
			try {
				const [response] = await Promise.all([
					page.goto(payload.url),
					page.waitForNavigation({ waitUntil: "networkidle0" }),
				]);
				if (response && ![200, 304].includes(response.status())) {
					return {
						ok: false,
						code: response.status(),
					};
				}
				const ret = await worker(payload, page);
				return { ok: true, value: ret };
			} catch (e: unknown) {
				return {
					ok: false,
					error: e,
				};
			} finally {
				await page.close();
			}
		};
		const enqueue = async (browser: Browser): Promise<void> => {
			const payload = payloads.pop();
			if (payload === undefined) {
				logger.debug(
					`Disconnect from browser ${browser.process()?.pid}`,
					"BROWSER_POOL",
				);
				await browser.disconnect();
				return Promise.resolve();
			}
			ret.push(await actualWorker(payload, browser));
			return Promise.resolve().then(() => enqueue(browser));
		};
		const ret: OkOrValue<ReturnType>[] = [];
		const promise = this.pool
			.map((wsEndpoint) => {
				return connect({ browserWSEndpoint: wsEndpoint });
			})
			.map((p) =>
				p
					.catch((e) => {
						logger.err(
							`Failed to connect to browser: ${e}`,
							"BROWSER_POOL",
						);
						return Promise.reject();
					})
					.then(
						async (browser) => {
							logger.debug(
								`Connected to browser: ${browser.process()?.pid}`,
								"BROWSER_POOL",
							);
							await enqueue(browser);
						},
						() => Promise.resolve(),
					),
			);
		await Promise.all(promise);
		return ret;
	}
	public async close(): Promise<void> {
		await Promise.all(
			this.pool.map((wsEndpoint) => {
				return connect({ browserWSEndpoint: wsEndpoint }).then(
					(browser) => {
						return browser.close();
					},
				);
			}),
		);
	}
}

export async function initializeBrowserPool(
	maxConcurrent: number,
): Promise<BrowserPool> {
	const tmpPath = config.TMP_PATH;
	if (!fs.existsSync(tmpPath)) {
		fs.mkdirSync(tmpPath);
	}

	const ret = new BrowserPool();

	for (let i = 0; i < maxConcurrent; i++) {
		const browser = await launch({
			headless: false,
			args: [
				"--disable-features=StylesWithCss=false",
				"--blink-settings=imagesEnabled=false",
				`--user-data-dir=${path.resolve(tmpPath)}`,
				"--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
				"--disable-logging",
				"--log-level=3",
				"--no-sandbox",
			],
		});

		// 保持浏览器打开
		browser.waitForTarget(() => delay(30 * 1000).then(() => true));

		logger.debug(
			`Browser launched with PID ${browser.process()?.pid}`,
			"BROWSER",
		);

		logger.debug(
			`Browser WebSocket endpoint: ${browser.wsEndpoint()}`,
			"BROWSER",
		);

		// 将浏览器的 WebSocket 端点添加到池中
		// 这里使用中括号调用 addBrowser 方法，绕过 private 修饰符
		ret["addBrowser"](browser.wsEndpoint());
	}
	return ret;
}
