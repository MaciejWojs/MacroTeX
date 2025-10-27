import esbuild from "esbuild";
import config from "./esbuild.config";

esbuild.build(config).catch(() => process.exit(1));

esbuild.build({
  entryPoints: ["./src/media/*.ts"],
  bundle: true,
  platform: "browser",
  outdir: "./dist/",
  minify: true,
})


esbuild.build({
  entryPoints: ["./src/webview-js/*.js"],
  bundle: true,
  platform: "browser",
  outdir: "./dist",
  minify: true,
})