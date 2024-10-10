export function isUrl(str: string | undefined): str is string {
	if (str === undefined) {
		return false;
	}
	const httpUrlPattern = /^(http|https):\/\/.+/i;
	return httpUrlPattern.test(str);
}
