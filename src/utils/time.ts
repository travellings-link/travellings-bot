import moment from "moment-timezone";

export function time() {
	return moment.tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss");
}

export function durationTime(seconds: number) {
	const dur = moment.duration(seconds * 1000);
	return `${dur.hours()} 小时 ${dur.minutes()} 分钟 ${dur.seconds()} 秒`;
}
