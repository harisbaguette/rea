import { cp, mkdir, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { build } from "esbuild";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const assets = {};
async function add(path, url) {
  assets[url] = {
    type: mime[extname(path)] || "application/octet-stream",
    body: (await readFile(path)).toString("base64"),
  };
}
async function walk(directory, prefix) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    if (item.isDirectory())
      await walk(join(directory, item.name), `${prefix}/${item.name}`);
    else await add(join(directory, item.name), `${prefix}/${item.name}`);
  }
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await mkdir(".openai/local", { recursive: true });
await add("index.html", "/index.html");
await walk("src", "/src");
await walk("public", "");
await writeFile(
  ".openai/local/assets.js",
  `export default ${JSON.stringify(assets)};\n`,
);
await build({
  entryPoints: ["worker/index.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/server/index.js",
  minify: true,
  legalComments: "inline",
});
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
console.log(
  `서버와 에셋 ${Object.keys(assets).length}개 빌드 완료: dist/server/index.js`,
);
