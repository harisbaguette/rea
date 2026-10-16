import { handleApi } from "../server/api.js";
import assets from "../.openai/local/assets.js";
import {authorize, protectedFetcher, securityHeaders} from '../server/access.js';
export {AccessGuard} from '../server/access-guard.js';

export default {
  async fetch(request, env) {
    try {return securityHeaders(await serve(request, env));}
    catch {return securityHeaders(Response.json({error: {code: 'ACCESS_UNAVAILABLE', message: '접속을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'}}, {status: 503}));}
  },
};
async function serve(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "air.bluekite.co.kr" && url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.href, 308);
    }
    const access = await authorize(request, env, assets);
    if (access.response) return access.response;
    const apiResponse = await handleApi(request, {fetcher: protectedFetcher(env, access.session)});
    if (apiResponse) {apiResponse.headers.set("Strict-Transport-Security","max-age=31536000");return apiResponse;}
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
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Strict-Transport-Security":"max-age=31536000",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        `default-src 'self'; script-src 'self'${file.scriptHash ? ` '${file.scriptHash}'` : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    const body = Uint8Array.from(atob(file.body), (char) => char.charCodeAt(0));
    return new Response(body, { headers });
}
