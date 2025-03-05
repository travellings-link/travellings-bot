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

import { config } from "../config";
import { WaitToRunMessageQueue } from "../utils/messageQueue";
import sql from "./sqlConfig";
import { Logger } from "./typedLogger";

class WebModel extends Model<
	InferAttributes<WebModel>,
	InferCreationAttributes<WebModel>
> {
	declare id: number;
	declare status: string;
	declare name: string;
	declare link: string;
	declare tag: string | null;
	declare failedReason: string | null;
	declare lastStatusRunTime: Date | null; // 这个字段用于存储上一次检查为 RUN 状态的时间
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
		lastStatusRunTime: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		tableName: "webs",
		sequelize: sql,
		timestamps: false,
		hooks: {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			beforeUpdate: async (webModel, _options) => {
				const sql_logger = new Logger("_SQL");
				if (webModel.previous("status") === "WAIT") {
					if (webModel.status === "RUN") {
						sql_logger.debug(
							`ID >> ${webModel.id}, SQL >> WAIT → RUN`,
							"SQL",
						);
						if (!config.NO_TOKEN_MODE) {
							WaitToRunMessageQueue.getInstance().enqueue(
								webModel.id,
							);
						}
					} else {
						// 阻止从 WAIT 修改到非 RUN
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
