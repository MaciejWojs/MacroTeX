import esbuild from "esbuild";
import config from "./esbuild.config";

esbuild.build(config).catch(() => process.exit(1));

esbuild.build({
  entryPoints: ["./src/media/toolkit.ts"],
    bundle: true,
    platform: "browser",
    outfile: "./dist/toolkit.js",
    minify: true,
})