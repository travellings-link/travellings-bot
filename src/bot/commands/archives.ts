// 回收站 Bot 命令
// By [AmisKwok](https://github.com/AmisKwok)
import { ArchiveModel } from "../../modules/sqlModel";
import {
	clearAllArchives,
	deleteArchive,
	deleteArchivesByStatus,
	getArchiveStatuses,
	getArchives,
	restoreArchive,
	runAutoArchive,
} from "../../utils/archiveManager";
import { MessageProcessor } from "../adapters/botAdapter";

/**
 * /archives - 查看回收站列表
 */
export const archives: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const page = args[1] ? parseInt(args[1]) : 1;
	const pageSize = 10;
	const offset = (page - 1) * pageSize;

	const archivesList = await getArchives(pageSize, offset);
	const total = await ArchiveModel.count();

	if (archivesList.length === 0) {
		ctx.reply("回收站是空的喔~");
		return;
	}

	let message = `📦 回收站 (第 ${page} 页，共 ${Math.ceil(total / pageSize)} 页)\n\n`;
	archivesList.forEach((archive, index) => {
		const idx = offset + index + 1;
		message += `${idx}. [${archive.id}] ${archive.name}\n`;
		message += `   🔗 ${archive.link}\n`;
		message += `   📋 状态: ${archive.status}\n`;
		message += `   📝 原因: ${archive.archiveReason}\n`;
		message += `   🕐 归档时间: ${archive.archivedAt.toLocaleString()}\n\n`;
	});

	message += `\n💡 共 ${Math.ceil(total / pageSize)} 页，使用 /archives <页码> 翻页\n`;
	message += "💡 使用 /archive_statuses 查看归档状态统计\n";
	message += "💡 使用 /restore <ID> 恢复站点\n";
	message += "💡 使用 /delete_archive <ID> 删除归档\n";
	message += "💡 使用 /delete_archive_by_status <状态> 按状态批量删除\n";
	message += "   常见状态: LOST, ERROR, TIMEOUT, 404, 500, 502\n";
	message += "💡 使用 /clear_archives 清空回收站";

	ctx.reply(message);
};

/**
 * /restore <ID> - 恢复站点
 */
export const restore: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const idStr = args[1];

	if (!idStr || isNaN(parseInt(idStr))) {
		ctx.reply("请提供有效的归档 ID 喵，例如: /restore 123");
		return;
	}

	const archiveId = parseInt(idStr);
	const result = await restoreArchive(archiveId);

	if (result) {
		ctx.reply(`✅ 已成功恢复站点: ${result.name}`);
	} else {
		ctx.reply("未找到该归档记录喵，请检查 ID 是否正确");
	}
};

/**
 * /delete_archive <ID> - 删除归档
 */
export const delete_archive: MessageProcessor = async (ctx) => {
	const args = (await ctx.getMessageText()).split(" ");
	const idStr = args[1];

	if (!idStr || isNaN(parseInt(idStr))) {
		ctx.reply("请提供有效的归档 ID 喵，例如: /delete_archive 123");
		return;
	}

	const archiveId = parseInt(idStr);
	const result = await deleteArchive(archiveId);

	if (result) {
		ctx.reply("✅ 已永久删除该归档记录");
	} else {
		ctx.reply("未找到该归档记录喵，请检查 ID 是否正确");
	}
};

/**
 * /clear_archives - 清空回收站
 */
export const clear_archives: MessageProcessor = async (ctx) => {
	const count = await clearAllArchives();
	if (count > 0) {
		ctx.reply(`✅ 已清空回收站，共删除 ${count} 个归档记录`);
	} else {
		ctx.reply("回收站已经是空的喵~");
	}
};

/**
 * /archive_now - 立即执行归档巡查
 */
export const archive_now: MessageProcessor = async (ctx) => {
	ctx.reply("🚀 开始执行归档巡查，请稍后查看结果...");
	const result = await runAutoArchive();
	if (result.archivedCount === 0 && result.recoveredCount === 0) {
		ctx.reply("✅ 巡查完成，没有需要归档或恢复的站点");
	}
};

/**
 * /archive_statuses - 查看归档状态统计
 */
export const archive_statuses: MessageProcessor = async (ctx) => {
	const statuses = await getArchiveStatuses();

	if (statuses.length === 0) {
		ctx.reply("回收站是空的喵~");
		return;
	}

	let message = "📊 归档状态统计\n\n";
	statuses.forEach((item, index) => {
		message += `${index + 1}. ${item.status} - ${item.count} 个\n`;
	});

	message += "\n💡 使用 /delete_archive_by_status <状态> 按状态批量删除";
	message += "\n   (例如: /delete_archive_by_status 404)";
	message += "\n   常见状态: LOST, ERROR, TIMEOUT, 404, 500, 502";

	ctx.reply(message);
};

/**
 * /delete_archive_by_status <状态> - 按状态批量删除
 */
export const delete_archive_by_status: MessageProcessor = async (ctx) => {
	const messageText = await ctx.getMessageText();
	const args = messageText.split(" ");
	const status = args.slice(1).join(" ");

	if (!status || status.trim() === "") {
		ctx.reply(
			"请提供要删除的归档状态喵，例如:\n/delete_archive_by_status 404",
		);
		return;
	}

	const count = await deleteArchivesByStatus(status);

	if (count > 0) {
		ctx.reply(`✅ 已删除 ${count} 个状态为「${status}」的归档记录`);
	} else {
		ctx.reply("没有找到匹配的归档记录喵，请检查状态是否完全匹配");
	}
};
