import { createFlightService, FlightError } from "./flights.js";

export function createApi({
  service = createFlightService(),
  now = () => Date.now(),
} = {}) {
  const buckets = new Map();
  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      },
    });
  return async function handleApi(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return null;
    const requestId = crypto.randomUUID();
    try {
      if (request.method !== "GET")
        return json(
          {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "GET 요청만 지원합니다.",
            },
            requestId,
          },
          405,
          { Allow: "GET" },
        );
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin)
        throw new FlightError(
          403,
          "ORIGIN_DENIED",
          "이 사이트에서 직접 조회해 주세요.",
        );
      if (
        ![
          "/api/health",
          "/api/routes",
          "/api/flights",
          "/api/history",
          "/api/book",
        ].includes(url.pathname)
      )
        throw new FlightError(404, "NOT_FOUND", "조회 주소를 찾을 수 없어요.");
      if (url.search.length > 600)
        throw new FlightError(400, "INVALID_QUERY", "조회 조건이 너무 깁니다.");
      if (url.pathname === "/api/health")
        return json({ status: "ok", service: "tteum-flights", version: 2 });
      const allowed = {
        "/api/routes": ["origin"],
        "/api/flights": [
          "origin",
          "start",
          "end",
          "minNights",
          "buffer",
          "exact",
        ],
        "/api/history": ["origin", "code", "start", "end", "partner"],
        "/api/book": ["origin", "code", "start", "end", "partner"],
      }[url.pathname];
      if (
        [...url.searchParams.keys()].some(
          (key) =>
            !allowed.includes(key) || url.searchParams.getAll(key).length !== 1,
        )
      )
        throw new FlightError(
          400,
          "INVALID_QUERY",
          "지원하지 않는 조회 조건입니다.",
        );
      const client = request.headers.get("CF-Connecting-IP") || "local";
      const previous = buckets.get(client),
        current = now();
      const bucket =
        previous && current - previous.at < 60000
          ? previous
          : { at: current, count: 0 };
      if (++bucket.count > 40)
        throw new FlightError(
          429,
          "RATE_LIMITED",
          "조회가 너무 잦아요. 1분 후 다시 시도해 주세요.",
          60,
        );
      if (buckets.size > 1000) buckets.delete(buckets.keys().next().value);
      buckets.set(client, bucket);
      const input = Object.fromEntries(url.searchParams);
      if (url.pathname === "/api/routes")
        return json({ routes: await service.routes(input.origin) });
      if (url.pathname === "/api/flights")
        return json(await service.search(input));
      if (url.pathname === "/api/history")
        return json(await service.history(input));
      if (url.pathname === "/api/book") {
        const result = await service.booking(input);
        return new Response(null, {
          status: 302,
          headers: {
            Location: result.url,
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      }
    } catch (error) {
      const known = error instanceof FlightError;
      const status = known ? error.status : 500;
      if (status >= 500)
        console.error(
          JSON.stringify({
            at: new Date(now()).toISOString(),
            level: "error",
            requestId,
            path: url.pathname,
            status,
            code: known ? error.code : "INTERNAL_ERROR",
          }),
        );
      if (url.pathname === "/api/book" && status >= 500) {
        const escape = (value) =>
          String(value).replace(
            /[&<>"']/g,
            (char) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[char],
          );
        const q = url.searchParams;
        const valid =
          /^[A-Z]{3}$/.test(q.get("origin") || "") &&
          /^[A-Z]{3}$/.test(q.get("code") || "") &&
          /^202[67]-\d{2}-\d{2}$/.test(q.get("start") || "") &&
          /^202[67]-\d{2}-\d{2}$/.test(q.get("end") || "");
        const otherSearch = valid
          ? `https://www.skyscanner.co.kr/transport/flights/${q.get("origin").toLowerCase()}/${q.get("code").toLowerCase()}/${q.get("start").slice(2).replaceAll("-", "")}/${q.get("end").slice(2).replaceAll("-", "")}/?adults=1&rtn=1&currency=KRW`
          : "/";
        return new Response(
          `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>판매처 연결 안내 · 틈</title><style>body{font-family:system-ui,sans-serif;background:#f7f9f8;color:#18342e;margin:0;padding:40px 24px}main{max-width:480px;margin:10vh auto;padding:28px;background:white;border:1px solid #e2e9e5;border-radius:16px}h1{font-size:24px}p{font-size:15px;line-height:1.8;color:#596e65}a{display:block;padding:14px;margin-top:12px;border-radius:8px;text-align:center;color:#087f6a;text-decoration:none;border:1px solid #c8ded2}a.primary{background:#087f6a;color:white}</style><main><h1>판매처에 연결하지 못했어요</h1><p>연결 주소를 만드는 중 일시적인 문제가 생겼습니다. 다시 연결하거나 같은 날짜로 다른 검색을 이용해 주세요.</p><a class="primary" href="${escape(url.pathname + url.search)}">판매처 다시 연결</a><a href="${escape(otherSearch)}" rel="noopener noreferrer">같은 날짜로 스카이스캐너 검색</a><a href="/">다른 항공권 보기</a></main></html>`,
          {
            status,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy":
                "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
            },
          },
        );
      }
      return json(
        {
          error: {
            code: known ? error.code : "INTERNAL_ERROR",
            message: known
              ? error.message
              : "조회 중 문제가 생겼어요. 다시 시도해 주세요.",
          },
          requestId,
        },
        status,
        error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
      );
    }
  };
}
export const handleApi = createApi();
