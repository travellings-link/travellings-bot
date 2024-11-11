import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	{
		ignores: ["dist/**/*", "eslint.config.mjs"],
	},
	...fixupConfigRules(
		compat.extends(
			"eslint:recommended",
			"plugin:@typescript-eslint/recommended",
			"plugin:import/recommended",
			"plugin:import/typescript"
		)
	),
	{
		plugins: {
			"@typescript-eslint": fixupPluginRules(typescriptEslint),
			import: fixupPluginRules(_import),
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.commonjs,
			},

			parser: tsParser,
			ecmaVersion: 5,
			sourceType: "module",

			parserOptions: {
				project: "./tsconfig.json",
			},
		},

		settings: {
			"import/parsers": {
				"@typescript-eslint/parser": [".ts", ".tsx"],
			},

			"import/resolver": {
				typescript: true,
			},
		},

		rules: {},
	},
];
