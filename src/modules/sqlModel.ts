//  ____   ___  _          __  __           _      _
// / ___| / _ \| |        |  \/  | ___   __| | ___| |
// \___ \| | | | |   _____| |\/| |/ _ \ / _` |/ _ \ |
//  ___) | |_| | |__|_____| |  | | (_) | (_| |  __/ |
// |____/ \__\_\_____|    |_|  |_|\___/ \__,_|\___|_|
//
// By BLxcwg666 <huixcwg@gmail.com>
import {
	CreationOptional,
	DataTypes,
	InferAttributes,
	InferCreationAttributes,
	Model,
} from "sequelize";
import { Op } from "sequelize";

import { config } from "../config";
import { WaitToRunMessageQueue } from "../utils/messageQueue";
import sql from "./sqlConfig";
import { Logger } from "./typedLogger";

/**
 * 站点状态枚举。
 *
 * 约定：除 `RUN` 外，所有状态都不会被 Travellings 跳转。
 * - `RUN`：正常跳转
 * - `LOST`：巡查发现无徽标 / 失去联系
 * - `ERROR`：访问异常
 * - `TIMEOUT`：访问超时
 * - `WAIT`：人工审核异常（锁定状态，除 →RUN/→ARCHIVED/→DELETED 外不可改）
 * - HTTP 状态码（如 403）：具体错误码，不会跳转
 * - `ARCHIVED`：已进入回收站（待删除），由归档流程写入
 * - `DELETED`：已软删除，对外查询默认隐藏（见 `defaultScope`）
 */
export const WebStatus = {
	RUN: "RUN",
	LOST: "LOST",
	ERROR: "ERROR",
	TIMEOUT: "TIMEOUT",
	WAIT: "WAIT",
	ARCHIVED: "ARCHIVED",
	DELETED: "DELETED",
} as const;

export type WebStatusValue = (typeof WebStatus)[keyof typeof WebStatus];

/** 进入回收站 / 软删除时使用的状态（供 archiveManager 与回收站命令复用） */
export const ARCHIVE_STATUS = WebStatus.ARCHIVED;
export const DELETED_STATUS = WebStatus.DELETED;

/** 所有「非 RUN」状态（不会被跳转） */
export const NON_RUN_STATUSES: WebStatusValue[] = [
	WebStatus.LOST,
	WebStatus.ERROR,
	WebStatus.TIMEOUT,
	WebStatus.WAIT,
	WebStatus.ARCHIVED,
	WebStatus.DELETED,
];

class WebModel extends Model<
	InferAttributes<WebModel>,
	InferCreationAttributes<WebModel>
> {
	declare id: CreationOptional<number>;
	declare status: string;
	declare name: string;
	declare link: string;
	declare tag: string | null;
	declare failedReason: string | null;
	declare lastManualCheck: Date | null;
	declare lastUpdated: Date | null;
}

WebModel.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		status: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		link: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		tag: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		failedReason: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		lastManualCheck: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		lastUpdated: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		tableName: "webs",
		sequelize: sql,
		timestamps: false,
		// 软删除：默认隐藏 status = DELETED 的站点（API 隐藏效果）
		defaultScope: {
			where: {
				status: {
					[Op.ne]: WebStatus.DELETED,
				},
			},
		},
		scopes: {
			// 回收站命令需绕过 defaultScope 查看所有站点
			withDeleted: {},
			// 仅回收站中的站点
			archived: {
				where: {
					status: WebStatus.ARCHIVED,
				},
			},
			// 巡查/对外查询可处理的站点：排除回收站与已软删除
			checkable: {
				where: {
					status: {
						[Op.notIn]: [WebStatus.ARCHIVED, WebStatus.DELETED],
					},
				},
			},
		},
		hooks: {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			beforeUpdate: async (webModel, _options) => {
				const sql_logger = new Logger("_SQL");
				if (webModel.previous("status") === "WAIT") {
					if (
						webModel.status === "RUN" ||
						webModel.status === WebStatus.ARCHIVED ||
						webModel.status === WebStatus.DELETED
					) {
						sql_logger.debug(
							`ID >> ${webModel.id}, SQL >> WAIT → ${webModel.status}`,
							"SQL",
						);
						if (
							webModel.status === "RUN" &&
							!config.NO_TOKEN_MODE
						) {
							WaitToRunMessageQueue.getInstance().enqueue(
								webModel.id,
							);
						}
					} else {
						// 阻止从 WAIT 修改到非 RUN/非 ARCHIVED/非 DELETED
						sql_logger.debug(
							`ID >> ${webModel.id}, SQL >> WAIT x→ ${webModel.status}`,
							"SQL",
						);
						// 手动将 status 设置回 WAIT
						webModel.status = "WAIT";
					}
				}
			},
		},
	},
);

class UserModel extends Model<
	InferAttributes<UserModel>,
	InferCreationAttributes<UserModel>
> {
	declare id: number;
	declare user: string;
	declare token: string;
	declare role: string;
	declare lastLogin: CreationOptional<string>;
}

UserModel.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		user: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		token: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		role: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		lastLogin: {
			type: DataTypes.STRING,
			allowNull: true,
		},
	},
	{
		tableName: "webs",
		sequelize: sql,
		timestamps: false,
	},
);

export { WebModel, UserModel };
