// 归档管理模块
// By [AmisKwok](https://github.com/AmisKwok)
import axios, { AxiosError } from "axios";
import { Op } from "sequelize";

import { botManager } from "../bot/botManager";
import { config } from "../config";
import sql from "../modules/sqlConfig";
import { ArchiveModel, WebModel } from "../modules/sqlModel";
import { Logger } from "../modules/typedLogger";

// axios 检查配置
const axiosConfig = {
	headers: {
		"User-Agent":
			"Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)",
	},
	timeout: config.LOAD_TIMEOUT * 1000,
	maxRedirects: 5,
	validateStatus: null,
};

const logger = new Logger("ArchiveManager");

/**
 * 快速检查单个 URL（简化版，只检查 HTTP 状态，不检查内容）
 */
async function quickCheckURL(
	siteURL: string,
): Promise<{ status: string; isOk: boolean }> {
	try {
		const response = await axios.get(siteURL, axiosConfig);
		if ([200, 304].includes(response.status)) {
			return { status: "RUN", isOk: true };
		}
		if (response.status.toString().startsWith("4")) {
			return { status: response.status.toString(), isOk: false };
		}
		if (response.status.toString().startsWith("5")) {
			return { status: response.status.toString(), isOk: false };
		}
		return { status: "ERROR", isOk: false };
	} catch (error) {
		if (error instanceof AxiosError) {
			if (error.code === "ECONNABORTED") {
				return { status: "TIMEOUT", isOk: false };
			}
		}
		return { status: "ERROR", isOk: false };
	}
}

/**
 * 根据状态获取归档原因描述
 */
function getArchiveReason(status: string): string {
	const reasonMap: Record<string, string> = {
		LOST: "站点失去联系",
		ERROR: "站点访问错误",
		TIMEOUT: "站点访问超时",
	};
	if (status.startsWith("4")) {
		return `客户端错误 ${status}`;
	}
	if (status.startsWith("5")) {
		return `服务器错误 ${status}`;
	}
	return reasonMap[status] || `状态异常: ${status}`;
}

/**
 * 执行自动归档巡查
 */
export async function runAutoArchive(): Promise<{
	archivedCount: number;
	archivedSites: Array<{
		id: number;
		name: string;
		link: string;
		reason: string;
	}>;
	recoveredCount: number;
}> {
	logger.info("开始执行自动归档巡查", "Archive");

	// 发送开始通知
	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "🚀 回收站自动巡查开始" }],
		[{ type: "text", content: "" }],
		[
			{
				type: "text",
				content: `正在扫描符合归档条件的站点 (阈值: ${config.AUTO_ARCHIVE_THRESHOLD_DAYS} 天)`,
			},
		],
		config.ARCHIVE_RECHECK_BEFORE
			? [
					{
						type: "text",
						content: "🔍 归档前将重新检查站点状态 (使用 axios)",
					},
				]
			: [],
	]);

	const thresholdDate = new Date(
		Date.now() - config.AUTO_ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
	);

	// 查找符合条件的站点 (状态异常)
	const sitesToCheck = await WebModel.findAll({
		where: {
			[Op.and]: [
				{
					[Op.or]: [
						{ status: { [Op.in]: ["LOST", "ERROR", "TIMEOUT"] } },
						{ status: { [Op.like]: "4%" } },
						{ status: { [Op.like]: "5%" } },
					],
				},
				{
					[Op.or]: [
						{ lastUpdated: { [Op.lt]: thresholdDate } },
						{ lastUpdated: { [Op.is]: null } },
					],
				},
			],
		},
	});

	if (sitesToCheck.length === 0) {
		logger.info("没有需要归档的站点", "Archive");
		botManager.boardcastRichTextMessage([
			[{ type: "text", bold: true, content: "✅ 回收站巡查完成" }],
			[{ type: "text", content: "" }],
			[{ type: "text", content: "没有发现需要归档的站点" }],
		]);
		return { archivedCount: 0, archivedSites: [], recoveredCount: 0 };
	}

	const archivedSites: Array<{
		id: number;
		name: string;
		link: string;
		reason: string;
	}> = [];
	const recoveredSites: Array<{
		id: number;
		name: string;
		link: string;
	}> = [];

	// 使用事务进行处理
	await sql.transaction(async (t) => {
		for (const site of sitesToCheck) {
			if (!site) continue;

			let currentStatus = site.status || "";

			// 如果启用了检查，在归档前重新检查
			if (config.ARCHIVE_RECHECK_BEFORE) {
				try {
					const checkResult = await quickCheckURL(site.link);
					if (checkResult.isOk) {
						// 站点已经恢复了，更新它而不归档
						await site.update(
							{
								status: "RUN",
								failedReason: null,
								lastUpdated: new Date(),
							},
							{ transaction: t },
						);
						recoveredSites.push({
							id: site.id,
							name: site.name,
							link: site.link,
						});
						logger.info(
							`站点已恢复，不归档: ${site.name} (${site.link})`,
							"Archive",
						);
						continue;
					}
					// 状态没恢复，还是用新状态
					currentStatus = checkResult.status;
				} catch {
					// 检查出错，还是用原状态继续
					logger.warn(
						`检查站点失败: ${site.name} - 使用原状态继续`,
						"Archive",
					);
				}
			}

			// 执行归档
			const reason = getArchiveReason(currentStatus);

			await ArchiveModel.create(
				{
					originalId: site.id,
					status: site.status,
					name: site.name,
					link: site.link,
					tag: site.tag,
					failedReason: site.failedReason,
					lastManualCheck: site.lastManualCheck,
					lastUpdated: site.lastUpdated,
					archivedAt: new Date(),
					archiveReason: reason,
				},
				{ transaction: t },
			);

			await site.destroy({ transaction: t });

			archivedSites.push({
				id: site.id,
				name: site.name,
				link: site.link,
				reason: reason,
			});

			logger.info(
				`已归档站点: ${site.name} (${site.link}) - 原因: ${reason}`,
				"Archive",
			);
		}
	});

	// 发送完成通知
	const messageParts = [
		[
			{
				type: "text",
				bold: true,
				content: config.ARCHIVE_RECHECK_BEFORE
					? "✅ 回收站巡查完成 [已重新检查]"
					: "✅ 回收站巡查完成 [未重新检查]",
			},
		],
		[{ type: "text", content: "" }],
	];

	// 添加恢复的站点信息
	if (recoveredSites.length > 0) {
		messageParts.push([
			{
				type: "text",
				bold: true,
				content: `🎉 发现 ${recoveredSites.length} 个站点已恢复:`,
			},
		]);
		const showRecoveredCount = Math.min(recoveredSites.length, 10);
		for (let i = 0; i < showRecoveredCount; i++) {
			const site = recoveredSites[i];
			if (site) {
				messageParts.push([
					{
						type: "text",
						content: `• ${site.name} - 已恢复正常`,
					},
				]);
			}
		}
		if (recoveredSites.length > 10) {
			messageParts.push([
				{
					type: "text",
					content: `... 还有 ${recoveredSites.length - 10} 个站点`,
				},
			]);
		}
		messageParts.push([{ type: "text", content: "" }]);
	}

	// 添加归档的站点信息
	if (archivedSites.length > 0) {
		messageParts.push([
			{
				type: "text",
				bold: true,
				content: `📦 共归档 ${archivedSites.length} 个站点:`,
			},
		]);
		const showArchivedCount = Math.min(archivedSites.length, 10);
		for (let i = 0; i < showArchivedCount; i++) {
			const site = archivedSites[i];
			if (site) {
				messageParts.push([
					{
						type: "text",
						content: `• ${site.name} - ${site.reason}`,
					},
				]);
			}
		}
		if (archivedSites.length > 10) {
			messageParts.push([
				{
					type: "text",
					content: `... 还有 ${archivedSites.length - 10} 个站点`,
				},
			]);
		}
	} else {
		messageParts.push([
			{ type: "text", content: "没有发现需要归档的站点" },
		]);
	}

	messageParts.push([{ type: "text", content: "" }]);
	messageParts.push([{ type: "text", content: "使用 /archives 查看回收站" }]);

	botManager.boardcastRichTextMessage(messageParts);

	return {
		archivedCount: archivedSites.length,
		archivedSites,
		recoveredCount: recoveredSites.length,
	};
}

/**
 * 获取回收站列表
 */
export async function getArchives(
	limit: number = 50,
	offset: number = 0,
): Promise<ArchiveModel[]> {
	return await ArchiveModel.findAll({
		order: [["archivedAt", "DESC"]],
		limit,
		offset,
	});
}

/**
 * 恢复单个站点
 */
export async function restoreArchive(
	archiveId: number,
): Promise<WebModel | null> {
	const archive = await ArchiveModel.findByPk(archiveId);
	if (!archive) {
		logger.warn(`未找到归档记录 ID: ${archiveId}`, "Restore");
		return null;
	}

	let restoredSite: WebModel | null = null;

	await sql.transaction(async (t) => {
		// 恢复到 webs 表
		restoredSite = await WebModel.create(
			{
				id: archive.originalId,
				status: archive.status,
				name: archive.name,
				link: archive.link,
				tag: archive.tag,
				failedReason: archive.failedReason,
				lastManualCheck: archive.lastManualCheck,
				lastUpdated: archive.lastUpdated,
			},
			{ transaction: t },
		);

		// 删除归档记录
		await archive.destroy({ transaction: t });
	});

	logger.info(`已恢复站点: ${archive.name} (${archive.link})`, "Restore");

	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "♻️ 站点已恢复" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: `名称: ${archive.name}` }],
		[{ type: "text", content: `链接: ${archive.link}` }],
	]);

	return restoredSite;
}

/**
 * 永久删除单个归档记录
 */
export async function deleteArchive(archiveId: number): Promise<boolean> {
	const archive = await ArchiveModel.findByPk(archiveId);
	if (!archive) {
		logger.warn(`未找到归档记录 ID: ${archiveId}`, "Delete");
		return false;
	}

	await archive.destroy();

	logger.info(`已永久删除归档: ${archive.name} (${archive.link})`, "Delete");

	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "🗑️ 归档已删除" }],
		[{ type: "text", content: "" }],
		[{ type: "text", content: `名称: ${archive.name}` }],
		[{ type: "text", content: `链接: ${archive.link}` }],
	]);

	return true;
}

/**
 * 清空回收站
 */
export async function clearAllArchives(): Promise<number> {
	const count = await ArchiveModel.count();
	if (count === 0) {
		return 0;
	}

	await ArchiveModel.destroy({ where: {} });

	logger.info(`已清空回收站，共删除 ${count} 个归档`, "ClearAll");

	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "🧹 回收站已清空" }],
		[{ type: "text", content: "" }],
		[
			{
				type: "text",
				content: `共永久删除 ${count} 个归档记录`,
			},
		],
	]);

	return count;
}

/**
 * 获取所有归档状态列表
 */
export async function getArchiveStatuses(): Promise<
	Array<{ status: string; count: number }>
> {
	const archives = await ArchiveModel.findAll({
		attributes: ["status"],
	});

	const statusCount: Record<string, number> = {};
	archives.forEach((archive) => {
		const status = archive.status || "未知";
		statusCount[status] = (statusCount[status] || 0) + 1;
	});

	return Object.entries(statusCount)
		.map(([status, count]) => ({ status, count }))
		.sort((a, b) => b.count - a.count);
}

/**
 * 按状态删除归档
 */
export async function deleteArchivesByStatus(status: string): Promise<number> {
	const archives = await ArchiveModel.findAll({
		where: { status: status },
	});

	if (archives.length === 0) {
		return 0;
	}

	await ArchiveModel.destroy({
		where: { status: status },
	});

	logger.info(
		`已按状态删除 ${archives.length} 个归档: ${status}`,
		"DeleteByStatus",
	);

	botManager.boardcastRichTextMessage([
		[{ type: "text", bold: true, content: "🗂️ 批量删除完成" }],
		[{ type: "text", content: "" }],
		[
			{
				type: "text",
				content: `状态: ${status}`,
			},
		],
		[
			{
				type: "text",
				content: `共删除 ${archives.length} 个归档记录`,
			},
		],
	]);

	return archives.length;
}
