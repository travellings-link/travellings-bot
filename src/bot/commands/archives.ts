//   ___           _               ____            _           _   _____                 _       _
//  / _ \         | |             / ___| _   _ ___| |_ ___  __| | |  ___|   _ _ __   ___ (_)_ __ | |_
// | | | |_  _____| |_ ___ _ __   \___ \| | | / __| __/ _ \/ _` | | |_ | | | | '_ \ / _ \| | '_ \| __|
// | |_| \ \/ / -_) __/ -_) '  \   ___) | |_| \__ \ ||  __/ (_| | |  _|| |_| | |_) | (_) | | | | | |_
//  \___/ >__/ \__|\__\___|_||_| |____/ \__, |___/\__\___|\__,_| |_|   \__, | .__/ \___/|_|_| |_|\__|
//                                      |___/                          |___/|_|
// 回收站管理命令（软删除方案）
import { WebModel } from "../../modules/sqlModel";
import { Logger } from "../../modules/typedLogger";
import {
	archiveSite,
	clearAllArchives,
	deleteArchive,
	getArchives,
	restoreArchive,
} from "../../utils/archiveManager";
import { MessageProcessor } from "../adapters/botAdapter";

const archiveLogger = new Logger("_Archive");

/**
 * 将指定 ID 的站点移入回收站。
 */
export const archive: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const inputId = args[1];

	if (!inputId || isNaN(parseInt(inputId))) {
		ctx.reply("ID 无效，请输入纯数字喵");
		return;
	}

	const id = parseInt(inputId);
	try {
		const site = await WebModel.findByPk(id);
		if (!site) {
			ctx.reply("没找到这个站点喵~");
			return;
		}
		if (site.status === "ARCHIVED" || site.status === "DELETED") {
			ctx.reply("这个站点已经在回收站或已删除喵~");
			return;
		}
		await archiveSite(site, args.slice(2).join(" ") || "人工归档");
		ctx.reply(`已将站点 ID ${id} 移入回收站喵~`);
	} catch (error) {
		archiveLogger.err((error as Error).message, "ARCHIVE");
		ctx.reply("归档失败喵~ 更多信息可能包含在控制台输出中.");
	}
};

/**
 * 从回收站恢复指定 ID 的站点。
 */
export const restore: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const inputId = args[1];

	if (!inputId || isNaN(parseInt(inputId))) {
		ctx.reply("ID 无效，请输入纯数字喵");
		return;
	}

	try {
		const ok = await restoreArchive(parseInt(inputId));
		ctx.reply(ok ? "已恢复喵~" : "回收站里没找到这个站点喵~");
	} catch (error) {
		archiveLogger.err((error as Error).message, "ARCHIVE");
		ctx.reply("恢复失败喵~ 更多信息可能包含在控制台输出中.");
	}
};

/**
 * 永久（软）删除回收站中的指定 ID 站点。
 */
export const safeDelete: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const inputId = args[1];

	if (!inputId || isNaN(parseInt(inputId))) {
		ctx.reply("ID 无效，请输入纯数字喵");
		return;
	}

	try {
		const ok = await deleteArchive(parseInt(inputId));
		ctx.reply(ok ? "已软删除（隐藏）喵~" : "回收站里没找到这个站点喵~");
	} catch (error) {
		archiveLogger.err((error as Error).message, "ARCHIVE");
		ctx.reply("删除失败喵~ 更多信息可能包含在控制台输出中.");
	}
};

/**
 * 列出回收站中的所有站点。
 */
export const listArchivedSites: MessageProcessor = async (ctx) => {
	try {
		const archives = await getArchives();
		if (archives.length === 0) {
			ctx.reply("回收站是空的喵~");
			return;
		}

		const lines = archives.map((site) => {
			return `ID: ${site.id} | ${site.name} | ${site.link} | 状态: ${site.status}`;
		});

		ctx.replyWithRichText([
			[
				{
					type: "text",
					content: `回收站共 ${archives.length} 个站点：`,
					bold: true,
				},
			],
			...lines.map((line) => [{ type: "text", content: line }]),
		]);
	} catch (error) {
		archiveLogger.err((error as Error).message, "ARCHIVE");
		ctx.reply("查询回收站失败喵~");
	}
};

/**
 * 清空回收站（全部软删除）。
 */
export const clearArchives: MessageProcessor = async (ctx) => {
	try {
		const count = await clearAllArchives();
		ctx.reply(`已清空回收站，软删除了 ${count} 个站点喵~`);
	} catch (error) {
		archiveLogger.err((error as Error).message, "ARCHIVE");
		ctx.reply("清空回收站失败喵~");
	}
};

/**
 * 展示当前自动归档相关的状态配置。
 */
export const archiveStatuses: MessageProcessor = async (ctx) => {
	ctx.replyWithRichText([
		[{ type: "text", content: "回收站 / 归档 相关说明：", bold: true }],
		[
			{
				type: "text",
				content:
					"· 异常站点（LOST/ERROR/TIMEOUT/4xx）长期未恢复会被自动移入回收站（status → ARCHIVED）",
			},
		],
		[{ type: "text", content: "· 回收站内站点不会被 Travellings 跳转" }],
		[
			{
				type: "text",
				content:
					"· 永久删除为软删除（status → DELETED），对外查询默认隐藏，数据可回溯",
			},
		],
	]);
};

/**
 * 将指定状态的所有站点批量移入回收站。
 * 用法：/delete_archive_by_status <STATUS>
 */
export const deleteArchiveByStatus: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const targetStatus = args[1];
	if (!targetStatus) {
		ctx.reply("请输入要归档的状态，如 /delete_archive_by_status LOST");
		return;
	}
	try {
		const sites = await WebModel.findAll({
			where: {
				status: targetStatus,
			},
		});
		let count = 0;
		for (const site of sites) {
			await archiveSite(site, `按状态批量归档：${targetStatus}`);
			count++;
		}
		ctx.reply(`已将 ${count} 个状态为 ${targetStatus} 的站点移入回收站喵~`);
	} catch (error) {
		archiveLogger.err((error as Error).message, "ARCHIVE");
		ctx.reply("批量归档失败喵~");
	}
};

// 兼容 app.ts 中既有的命令注册名
export const archives = listArchivedSites;
export const archive_now = archive;
export const restore_archive = restore;
export const delete_archive = safeDelete;
export const clear_archives = clearArchives;
export const archive_statuses = archiveStatuses;
export const delete_archive_by_status = deleteArchiveByStatus;
