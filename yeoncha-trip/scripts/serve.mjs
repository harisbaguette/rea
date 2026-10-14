import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { handleApi } from "../server/api.js";
const root = resolve(".");
const artifactArg = process.argv.indexOf("--artifact");
const artifactPath =
  artifactArg >= 0
    ? process.argv[artifactArg + 1]
    : process.argv.includes("--dist")
      ? "dist/server/index.js"
      : null;
const artifact = artifactPath
  ? (await import(pathToFileURL(resolve(artifactPath)).href)).default
  : null;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (artifact) {
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
      });
      const response = await artifact.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
      });
      const response = await handleApi(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    else if (pathname.startsWith("/assets/")) pathname = `/public${pathname}`;
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${sep}`) || !(await stat(file)).isFile())
      throw new Error("not found");
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("페이지를 찾을 수 없습니다.");
  }
});
server.listen(Number(process.env.PORT || 4179), "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${server.address().port}`),
);
process.on("SIGTERM", () => server.close());
