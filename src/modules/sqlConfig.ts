//  ____   ___  _           ____             __ _
// / ___| / _ \| |         / ___|___  _ __  / _(_) __ _
// \___ \| | | | |   _____| |   / _ \| '_ \| |_| |/ _` |
//  ___) | |_| | |__|_____| |__| (_) | | | |  _| | (_| |
// |____/ \__\_\_____|     \____\___/|_| |_|_| |_|\__, |
//                                                |___/
// By BLxcwg666 <huixcwggmail.com>
import cls from "cls-hooked";
import { Sequelize } from "sequelize";

import { config } from "../config";
import { logger } from "./typedLogger";

// 创建一个 CLS 命名空间，用于自动传递数据库事务
const namespace = cls.createNamespace("travellings-bot-namespace");

Sequelize.useCLS(namespace);

const sql = new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASSWORD, {
	host: config.DB_HOST,
	port: config.DB_PORT,
	dialect: "mysql",
	logging: (msg) => {
		logger.debug(msg, "DB");
	},
});

export default sql;
