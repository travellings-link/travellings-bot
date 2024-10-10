/** @type {import("eslint").Linter.Config} */
module.exports = {
	env: {
		node: true,
		commonjs: true,
		es2021: true,
	},
	plugins: ["@typescript-eslint", "import"],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: "./tsconfig.json",
		sourceType: "",
	},
	settings: {
		"import/parsers": {
			"@typescript-eslint/parser": [".ts", ".tsx"],
		},
		"import/resolver": {
			typescript: true,
		},
	},
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:import/recommended",
		"plugin:import/typescript",
	],
	rules: {},
};
