module.exports = {
	printWidth: 80,
	tabWidth: 4,
	useTabs: true,
	endOfLine: "lf",
	importOrder: ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"],
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
	plugins: ["@trivago/prettier-plugin-sort-imports"],
};
