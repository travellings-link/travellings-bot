//  ____            _               __  __                          _          _    ____    _   _  ___
// | __ )  __ _ ___| |__           |  \/  | __ _ _ __   __ _  __ _| |_ ___   / \  | |_|__ \  / |/ ___|
// |  _ \ / _` / __| '_ \   _____  | |\/| |/ _` | '_ \ / _` |/ _` | __/ _ \ / _ \ | __| / /  | | |  _
// | |_) | (_| \__ \ | | | |_____| | |  | | (_| | | | | (_| | (_| | ||  __// ___ \| |_ / /_  | | |_| |
// |____/ \__,_|___/_| |_|         |_|  |_|\__,_|_| |_|\__, |\__,_|\__\___/_/   \_\__|____| |_|\____|
//
// 站点回收站 / 归档 / 软删除 管理工具
// 重构自双表硬删除方案：改为在 webs 表内用 status 标记 ARCHIVED / DELETED 实现软删除。
import { Op } from "sequelize";

import { botManager } from "../bot/botManager";
import { config } from "../config";
import {
	ARCHIVE_STATUS,
	DELETED_STATUS,
	WebModel,
	WebStatus,
} from "../modules/sqlModel";
import { Logger } from "../modules/typedLogger";

const archiveLogger = new Logger("_Archive");

/**
 * 将站点归档（进入回收站）。
 *
 * 仅把该站点的 status 改为 `ARCHIVED`，原记录保留在 webs 表，
 * 不再写入独立的 archives 表（避免数据冗余与不一致）。
 *
 * @param site 要归档的 WebModel 实例（任意非 RUN/DELETED 状态均可）
 * @param reason 归档原因，记录在 lastUpdated 备注（可选，写入 failedReason 仅作留痕不建议覆盖）
 */
export async function archiveSite(
	site: WebModel,
	reason?: string,
): Promise<void> {
	try {
		if (site.status === ARCHIVE_STATUS || site.status === DELETED_STATUS) {
			archiveLogger.debug(
				`ID >> ${site.id}, 已是归档/删除状态，跳过`,
				"ARCHIVE",
			);
			return;
		}
		site.status = ARCHIVE_STATUS;
		// 记录归档时间到 lastUpdated，方便回收站展示「停留时长」
		site.lastUpdated = new Date();
		if (reason) {
			site.failedReason = reason;
		}
		await site.save();
		archiveLogger.info(
			`ID >> ${site.id}, 已归档（status → ${ARCHIVE_STATUS}）`,
			"ARCHIVE",
		);
	} catch (error) {
		archiveLogger.err(
			`ID >> ${site.id}, 归档失败：${(error as Error).message}`,
			"ARCHIVE",
		);
		throw error;
	}
}

/**
 * 从回收站恢复站点。
 *
 * 将 status 从 ARCHIVED 改回 RUN（恢复即重新参与跳转与巡查）。
 * 如需恢复为其他状态，可传入 targetStatus。
 */
export async function restoreArchive(
	id: number,
	targetStatus: string = WebStatus.RUN,
): Promise<boolean> {
	try {
		// 回收站查询需要绕过 defaultScope（defaultScope 隐藏 DELETED，这里查 ARCHIVED 用 unscoped）
		const site = await WebModel.unscoped().findOne({
			where: {
				id,
				status: ARCHIVE_STATUS,
			},
		});
		if (!site) {
			archiveLogger.err(`ID >> ${id}, 回收站中未找到该站点`, "ARCHIVE");
			return false;
		}
		site.status = targetStatus;
		site.lastUpdated = new Date();
		await site.save();
		archiveLogger.info(
			`ID >> ${id}, 已恢复（status → ${targetStatus}）`,
			"ARCHIVE",
		);
		return true;
	} catch (error) {
		archiveLogger.err(
			`ID >> ${id}, 恢复失败：${(error as Error).message}`,
			"ARCHIVE",
		);
		return false;
	}
}

/**
 * 永久删除（软删除）。
 *
 * 仅把 status 改为 DELETED，原记录保留。defaultScope 已保证
 * 对外查询（巡查 / query 命令 / 对外 API）默认看不到 DELETED 站点，
 * 即实现「软删除 / API 隐藏」效果，无需真正 DELETE 行。
 *
 * @param id 站点 ID
 * @returns 是否成功
 */
export async function deleteArchive(id: number): Promise<boolean> {
	try {
		const site = await WebModel.unscoped().findOne({
			where: {
				id,
				status: ARCHIVE_STATUS,
			},
		});
		if (!site) {
			archiveLogger.err(`ID >> ${id}, 回收站中未找到该站点`, "ARCHIVE");
			return false;
		}
		site.status = DELETED_STATUS;
		site.lastUpdated = new Date();
		await site.save();
		archiveLogger.info(
			`ID >> ${id}, 已软删除（status → ${DELETED_STATUS}）`,
			"ARCHIVE",
		);
		return true;
	} catch (error) {
		archiveLogger.err(
			`ID >> ${id}, 软删除失败：${(error as Error).message}`,
			"ARCHIVE",
		);
		return false;
	}
}

/**
 * 获取回收站中的所有站点（status = ARCHIVED）。
 */
export async function getArchives(): Promise<WebModel[]> {
	try {
		return await WebModel.unscoped().findAll({
			where: {
				status: ARCHIVE_STATUS,
			},
			order: [["lastUpdated", "DESC"]],
		});
	} catch (error) {
		archiveLogger.err(
			`获取回收站失败：${(error as Error).message}`,
			"ARCHIVE",
		);
		return [];
	}
}

/**
 * 清空整个回收站（全部软删除）。
 *
 * 注意：这是对回收站内所有 ARCHIVED 站点执行软删除（status → DELETED），
 * 不会真正删除数据库行，保证数据安全可回溯。
 */
export async function clearAllArchives(): Promise<number> {
	try {
		const [affectedCount] = await WebModel.unscoped().update(
			{
				status: DELETED_STATUS,
				lastUpdated: new Date(),
			},
			{
				where: {
					status: ARCHIVE_STATUS,
				},
			},
		);
		archiveLogger.info(
			`已清空回收站，软删除 ${affectedCount} 个站点`,
			"ARCHIVE",
		);
		return affectedCount;
	} catch (error) {
		archiveLogger.err(
			`清空回收站失败：${(error as Error).message}`,
			"ARCHIVE",
		);
		return 0;
	}
}

/**
 * 自动归档巡查发现的异常站点。
 *
 * 根据配置的时间阈值，将长期停留在 LOST / ERROR / 4xx / TIMEOUT 等
 * 异常状态的站点自动标记到回收站（status → ARCHIVED）。
 * 不再依赖独立 archives 表。
 */
export async function runAutoArchive(): Promise<void> {
	try {
		const autoArchiveEnabled = config.AUTO_ARCHIVE_ENABLE;
		if (!autoArchiveEnabled) {
			archiveLogger.debug("自动归档未启用，跳过", "ARCHIVE");
			return;
		}

		const autoArchiveDays = config.AUTO_ARCHIVE_THRESHOLD_DAYS || 365;
		const thresholdDate = new Date(
			Date.now() - autoArchiveDays * 24 * 60 * 60 * 1000,
		);
		archiveLogger.info(
			`开始自动归档（异常停留超过 ${autoArchiveDays} 天）`,
			"ARCHIVE",
		);

		// 需要自动归档的异常状态（不含 WAIT：WAIT 需人工审核，不强转 ARCHIVED）
		const autoArchiveStatuses = [
			WebStatus.LOST,
			WebStatus.ERROR,
			WebStatus.TIMEOUT,
			"403",
			"404",
			"500",
		];

		const candidates = await WebModel.findAll({
			where: {
				status: {
					[Op.in]: autoArchiveStatuses,
				},
				lastManualCheck: {
					[Op.or]: [{ [Op.eq]: null }, { [Op.lt]: thresholdDate }],
				},
			},
		});

		let archivedCount = 0;
		for (const site of candidates) {
			try {
				await archiveSite(
					site,
					`自动归档：异常状态 ${site.status} 停留超过 ${autoArchiveDays} 天`,
				);
				archivedCount++;
			} catch {
				// 单个失败不影响整体
			}
		}

		archiveLogger.info(
			`自动归档完成，共 ${archivedCount} 个站点`,
			"ARCHIVE",
		);

		// 通知管理员
		if (archivedCount > 0 && !config.NO_TOKEN_MODE) {
			await botManager.boardcastMessage(
				`🔧 自动归档完成：共 ${archivedCount} 个异常站点被移入回收站。`,
			);
		}
	} catch (error) {
		archiveLogger.err(
			`自动归档失败：${(error as Error).message}`,
			"ARCHIVE",
		);
	}
}
