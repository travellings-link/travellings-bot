/**
 * 检查给定页面内容是否包含特定关键字或链接。
 *
 * 该函数会搜索页面内容中是否存在某些英文和中文关键字，以及特定的链接。它旨在判断内容是否与 “travelling” 或 “开往” 相关，并检测是否包括任何许可的外部链接。
 *
 * @param pageContent - 要检查的页面内容。
 * @param looseMode - 可选参数，在检查时是否启用宽松模式。
 * @returns 如果页面内容包含任意指定的关键字或链接，则返回 `true`，否则返回 `false`。
 */
export function checkPageContent(pageContent: string, looseMode?: boolean) {
	// 通过开往入口文字巡查
	// 可能的绕过方法 -> 站点挂个无实际跳转作用的文字
	const includeEN = pageContent.includes("travelling");
	const includeZH = pageContent.includes("开往");

	// 适配特殊情况
	const specialCases = [
		"anzhiyu.totraveling()", // hexo-theme-anzhiyu
		"totraveling()", // halo-theme-hao
		"https%3A%2F%2Fwww.travellings.cn%2Fplain.html", // ID 600 dao.js.cn
	];
	const includeSpecialCase = specialCases.some((caseItem) =>
		pageContent.includes(caseItem),
	);

	// 可能的绕过方法 -> 站点挂个假链接但是无实际跳转作用/挂个不可见的链接
	// 许可的开往跳转外链
	const links = [
		"www.travellings.cn/go.html",
		"www.travellings.cn/plain.html",
		"www.travellings.cn/coder-1024.html",
		"www.travellings.cn/go-by-clouds.html",
		"travellings.cn/go.html",
		"travellings.cn/plain.html",
		"travellings.cn/coder-1024.html",
		"travellings.cn/go-by-clouds.html",
		"travellings.link",
	];
	const includeLink = links.some((link) =>
		pageContent.includes(`https://${link}`),
	);
	return (
		includeLink ||
		includeSpecialCase ||
		(looseMode && (includeEN || includeZH))
	);
}
