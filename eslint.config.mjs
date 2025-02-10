import { includeIgnoreFile } from "@eslint/compat";
import pluginJs from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import eslintPluginImportX from "eslint-plugin-import-x";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, ".gitignore");

export default tseslint.config(
	includeIgnoreFile(gitignorePath),
	pluginJs.configs.recommended,
	eslintPluginImportX.flatConfigs.recommended,
	eslintPluginImportX.flatConfigs.typescript,
	tseslint.configs.recommended,
	{
		files: [
			"**/*.js",
			"**/*.cjs",
			"**/*.mjs",
			"**/*.cts",
			"**/*.ts",
			"**/*.mts",
		],
		ignores: ["eslint.config.mjs"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
		},
		languageOptions: {
			globals: {
				...globals.node,
				...globals.commonjs,
			},
		},
	},
	eslintPluginPrettierRecommended,
);
