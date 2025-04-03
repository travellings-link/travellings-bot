import { Op } from "sequelize";

import { botManager } from "../bot/botManager";
import { config } from "../config";
import axiosCheck from "../methods/axios";
import browserCheck from "../methods/browser";
import sql from "../modules/sqlConfig";
import { WebModel } from "../modules/sqlModel";
import { logger } from "../modules/typedLogger";
import { clearTravellingsAPICache } from "./clearTravellingsAPICache";

/**
 * 检查全部站点，并且在检查成运行结果过低的情况下撤回数据库修改
 */
export async function checkAll() {
	logger.info("✓ 开始巡查站点", "APP");

	// 创建事务，并执行代码
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	await sql.transaction(async (_t) => {
		await axiosCheck();
		await browserCheck();

		const runWebsCount = await WebModel.count({
			where: {
				status: {
					[Op.in]: ["RUN"],
				},
				lastManualCheck: {
					[Op.or]: [
						{ [Op.eq]: null },
						{
							[Op.lt]: new Date(
								new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
							),
						},
					],
				},
			},
		});
		const allWebsCount = await WebModel.count({
			where: {
				status: {
					[Op.notIn]: ["WAIT"],
				},
				lastManualCheck: {
					[Op.or]: [
						{ [Op.eq]: null },
						{
							[Op.lt]: new Date(
								new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
							),
						},
					],
				},
			},
		});

		// 计算百分比：检查为 RUN 的站点数/需要检查的站点数
		const runWebsPercentage = (runWebsCount / allWebsCount) * 100;
		// 可接受的最低占比
		const minRunSitesPercentage = config.MIN_RUN_SITES_PERCENTAGE;
		if (runWebsPercentage < minRunSitesPercentage) {
			logger.warn(
				`△ 状态正常的站点占比低于 ${minRunSitesPercentage}%: ${runWebsPercentage.toFixed(2)}%`,
				"APP",
			);

			// 调用开往 API 清除缓存
			clearTravellingsAPICache(logger);

			// 发送 bot 消息
			botManager.boardcastRichTextMessage([
				[{ type: "text", bold: true, content: "开往巡查姬提醒您：" }],
				[{ type: "text", content: "" }],
				[
					{
						type: "text",
						content: `巡查机巡查结果异常`,
					},
				],
				[
					{
						type: "text",
						bold: true,
						content: `状态正常的站点占比为 ${runWebsPercentage.toFixed(2)}%`,
					},
				],
				[
					{
						type: "text",
						content: `低于可接受的最低占比 ${minRunSitesPercentage}%`,
					},
				],
				[{ type: "text", content: "" }],
				[{ type: "text", content: `已自动撤回此次巡查的数据库修改` }],
			]);

			// 抛出异常以撤回数据库修改
			throw new Error("Rollback check results");
		}
		logger.ok(
			`✓ 状态正常的站点占比 ${runWebsPercentage.toFixed(2)}%`,
			"APP",
		);
	});

	logger.ok("✓ 检测完成", "APP");
}
