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
import sql from "./sqlConfig";

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
	},
	{
		tableName: "webs",
		sequelize: sql,
		timestamps: false,
	}
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
	}
);

export { WebModel, UserModel };
