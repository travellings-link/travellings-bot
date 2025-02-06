import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
	entries: ["src/app.ts"],
	outDir: "dist",
});
