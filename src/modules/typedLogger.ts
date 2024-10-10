// Forked from the travellings-link/travellings-bot/modules/logger.js
// Migrated Nekologger into ES Module and Typescript.
// Original author: BLxcwg666
// Migration Author: Allen You

import moment from "moment-timezone";
import chalk from "chalk";
import fs, { WriteStream } from "fs";
import path from "path";
import { config } from "../config";

function time() {
	return moment.tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss");
}

if (!fs.existsSync(config.LOG_PATH) && config.LOG_ENABLE) {
	fs.mkdirSync(config.LOG_PATH);
}

// Log levels
export const LOG_TRACE_LEVEL = -2;
export const LOG_DEBUG_LEVEL = -1;
export const LOG_INFO_LEVEL = 0;
export const LOG_WARN_LEVEL = 1;
export const LOG_ERROR_LEVEL = 2;

export class Logger {
	enableWrite = config.LOG_ENABLE;
	logStream: WriteStream | null = null;
	logLevel = 0;

	constructor(suffix: string = "") {
		if (config.LOG_LEVEL !== undefined) {
			// Set log level
			switch (config.LOG_LEVEL) {
				case "Trace":
					this.logLevel = LOG_TRACE_LEVEL;
					break;
				case "Debug":
					this.logLevel = LOG_DEBUG_LEVEL;
					break;
				case "Info":
					this.logLevel = LOG_INFO_LEVEL;
					break;
				case "Warn":
					this.logLevel = LOG_WARN_LEVEL;
					break;
				case "Error":
					this.logLevel = LOG_ERROR_LEVEL;
					break;
				default:
				// Do nothing
			}
		}
		if (this.enableWrite) {
			// Create file write stream
			this.logStream = fs.createWriteStream(
				path.join(
					config.LOG_PATH,
					`${moment
						.tz("Asia/Shanghai")
						.format("YYYY-MM-DD HH-mm-ss")}${suffix}.log`
				),
				{ flags: "a" }
			);
		}
	}

	info(msg: string, who: string) {
		if (this.logLevel > LOG_INFO_LEVEL) {
			return;
		}
		const log = `[${time()}] [${who}] [INFO] ${msg}`;
		console.log(chalk.blue(log));
		if (this.enableWrite) {
			this.logStream!.write("\n" + log);
		}
	}

	debug(msg: string, who: string) {
		if (this.logLevel > LOG_DEBUG_LEVEL) {
			return;
		}
		const log = `[${time()}] [${who}] [DEBUG] ${msg}`;
		console.log(chalk.green(log));
		if (this.enableWrite) {
			this.logStream!.write("\n" + log);
		}
	}

	warn(msg: string, who: string) {
		if (this.logLevel > LOG_WARN_LEVEL) {
			return;
		}
		const log = `[${time()}] [${who}] [WARN] ${msg}`;
		console.log(chalk.yellow(log));
		if (this.enableWrite) {
			this.logStream!.write("\n" + log);
		}
	}

	err(msg: string, who: string) {
		if (this.logLevel > LOG_ERROR_LEVEL) {
			return;
		}
		const log = `[${time()}] [${who}] [ERROR] ${msg}`;
		console.log(chalk.red(log));
		if (this.enableWrite) {
			this.logStream!.write("\n" + log);
		}
	}

	trace(msg: string, who: string) {
		if (this.logLevel > LOG_TRACE_LEVEL) {
			return;
		}
		const log = `[${time()}] [${who}] [TRACE] ${msg}`;
		console.log(chalk.cyan(log));
		if (this.enableWrite) {
			this.logStream!.write("\n" + log);
		}
	}
	close() {
		if (this.logStream !== null) {
			this.logStream.close();
		}
	}
}

export const logger = new Logger();
