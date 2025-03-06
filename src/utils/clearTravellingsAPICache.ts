import axios from "axios";

import { config } from "../config";
import { Logger } from "../modules/typedLogger";

/**
 * 调用开往 API 清除缓存
 *
 * @param logger - Logger 实例，用于发送日志
 * @returns
 */
export async function clearTravellingsAPICache(logger: Logger) {
	// 无 Token 模式跳过此部分
	if (config.NO_TOKEN_MODE) {
		return;
	}

	// 调用开往 API 清除缓存
	try {
		await axios.get(`${config.API_URL}/all`);
		await axios.delete(`${config.API_URL}/action/purgeCache`, {
			headers: { Cookie: `_tlogin=${config.API_TOKEN}` },
		});
	} catch (e) {
		logger.err((e as Error).message, "TRAVELLINGS API");
	}
}
