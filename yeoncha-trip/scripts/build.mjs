import { cp, mkdir, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { build } from "esbuild";
import { createHash } from "node:crypto";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
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
await walk("src", "/src");
await walk("public", "");
const clientJs = await build({ entryPoints: ["src/app.js"], bundle: true, minify: true, write: false, format: "esm", platform: "browser", target: "es2022", legalComments: "inline" });
const clientCss = await build({ stdin: { contents: "@import './src/styles.css';\n@import './src/motion.css';", resolveDir: process.cwd(), loader: "css" }, bundle: true, minify: true, write: false, external: ["/assets/*"] });
const clientPaths = {};
await mkdir("dist/client/assets", { recursive: true });
for (const [extension, result, type] of [["js", clientJs, mime[".js"]], ["css", clientCss, mime[".css"]]]) {
  const contents = result.outputFiles[0].contents;
  const hash = createHash("sha256").update(contents).digest("hex").slice(0, 12);
  const name = `app-${hash}.${extension}`;
  clientPaths[extension] = `/assets/${name}`;
  assets[clientPaths[extension]] = { type, body: Buffer.from(contents).toString("base64") };
  await writeFile(`dist/client/assets/${name}`, contents);
}
let html = (await readFile("index.html", "utf8"))
  .replace(/    <link rel="modulepreload"[^\n]+\n/g, "")
  .replace('href="/src/styles.css"', `href="${clientPaths.css}"`)
  .replace(/    <link rel="stylesheet" href="\/src\/motion\.css"[^\n]+\n/, "")
  .replace('src="/src/app.js"', `src="${clientPaths.js}"`);
// Sites authenticates each asset request. Deliver the first screen together so
// its typography, illustration and controls do not wait on extra round trips.
const dataUrl = path => `data:${assets[path].type};base64,${assets[path].body}`;
const css = Buffer.from(clientCss.outputFiles[0].contents).toString()
  .replaceAll('/assets/fonts/Pretendard-ui.woff2', dataUrl('/assets/fonts/Pretendard-ui.woff2'));
const script = Buffer.from(clientJs.outputFiles[0].contents).toString()
  .replaceAll('/assets/icons.svg#', '#')
  .replaceAll('</script', '<\\/script');
const sprite = Buffer.from(assets['/assets/icons.svg'].body, 'base64').toString()
  .replace('<svg ', '<svg aria-hidden="true" style="display:none" ');
html = html
  .replace(/    <link rel="preload" href="\/assets\/fonts\/Pretendard-ui\.woff2"[^\n]+\n/, '')
  .replace(`<link rel="stylesheet" href="${clientPaths.css}" />`, `<style>${css}</style>`)
  .replace(`<script type="module" src="${clientPaths.js}"></script>`, `<script type="module">${script}</script>`)
  .replaceAll('/assets/icons.svg#', '#')
  .replace('<body>', `<body>${sprite}`);
for (const path of ['/assets/flags/kr.svg', '/assets/brand/symbol.svg', '/assets/illustrations/airport-lounge.webp', '/assets/illustrations/airport-lounge-mobile.webp']) {
  html = html.replaceAll(path, dataUrl(path));
}
assets["/index.html"] = {
  type: mime[".html"], body: Buffer.from(html).toString("base64"),
  scriptHash: `sha256-${createHash('sha256').update(script).digest('base64')}`,
};
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
