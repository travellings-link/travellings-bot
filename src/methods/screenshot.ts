import fs from "fs";

import { config } from "../config";
import { WebModel } from "../modules/sqlModel";
import { logger } from "../modules/typedLogger";
import { initializeBrowserPool } from "../utils/browserPool";

// 如果不存在 tmp 就创建一个
const tmpPath = config.TMP_PATH;
if (!fs.existsSync(tmpPath)) {
	fs.mkdirSync(tmpPath);
}

/**
 * 根据给定的 ID 生成对应网页的截图。
 *
 * @param id - 数据库中网页记录的主键 ID。
 * @returns 一个 Promise，解析为包含截图图片的 Buffer。
 * @throws 如果未找到指定 ID 的网页会抛出错误。
 */
async function screenshotByID(id: number): Promise<Buffer> {
	const web = await WebModel.findByPk(id);

	if (!web) {
		throw new Error("没找到喵~ 你确定你输入的 ID 正确吗？");
	}

	return await screenshotByUrl(web.link);
}

/**
 * 根据指定的 URL 生成网页截图。
 *
 * @param url - 需要截图的网页 URL。
 * @returns 一个 Promise，解析为包含截图图片的 Buffer。
 * @throws 如果截图操作失败会抛出错误。
 */
async function screenshotByUrl(url: string): Promise<Buffer> {
	const pool = await initializeBrowserPool(1);
	const returnValues = await pool.work([{ url }], async (payload, page) => {
		logger.debug(`Navigating to ${payload.url}`, "SCREENSHOT");
		const buffer = Buffer.from(await page.screenshot());
		return { url, buffer };
	});
	const ret = returnValues.at(0) ?? {
		ok: false,
		error: new Error("No return value"),
	};
	if (!ret.ok) {
		const error = ret.error as Error;
		if (error.message !== undefined) {
			logger.err(error.message, "SCREENSHOT");
		}
		throw new Error("出错了喵~ 更多信息可能包含在控制台中~");
	}
	const { buffer } = ret.value;
	return buffer;
}

export { screenshotByID, screenshotByUrl };
