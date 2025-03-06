/**
 * 检查是否是合法链接
 *
 * @param url  链接
 * @returns 如果是合法链接就返回 true 否则返回 false
 */
export function isUrl(url: string | undefined): url is string {
	if (url === undefined) {
		return false;
	}
	const httpUrlPattern = /^(http|https):\/\/.+/i;
	return httpUrlPattern.test(url);
}
