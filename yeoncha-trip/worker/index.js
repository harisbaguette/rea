import { handleApi } from "../server/api.js";
import assets from "../.openai/local/assets.js";

export default {
  async fetch(request) {
    const apiResponse = await handleApi(request);
    if (apiResponse) return apiResponse;
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("허용하지 않는 요청입니다.", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = assets[path];
    if (!file)
      return new Response("페이지를 찾을 수 없습니다.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    const headers = {
      "Content-Type": file.type,
      "Cache-Control": path.startsWith("/assets/")
        ? "public, max-age=86400"
        : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    const body = Uint8Array.from(atob(file.body), (char) => char.charCodeAt(0));
    return new Response(body, { headers });
  },
};
