import { createFlightService, createFlightState, FlightError } from "./flights.js";
import { createItineraryService, createItineraryState } from './itineraries.js';

export function createApi({
  service,
  serviceFactory,
  itineraryFactory,
  now = () => Date.now(),
} = {}) {
  const buckets = new Map();
  let bucketEpoch=-1,bucketSalt='';
  async function clientKey(request){
    const epoch=Math.floor(now()/60000);
    if(epoch!==bucketEpoch){buckets.clear();bucketEpoch=epoch;bucketSalt=crypto.randomUUID();}
    const input=new TextEncoder().encode(`${bucketSalt}:${request.headers.get('CF-Connecting-IP')||'local'}`);
    const digest=await crypto.subtle.digest('SHA-256',input);
    return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  }
  const flightState = createFlightState();
  const itineraryState = createItineraryState();
  const forRequest = serviceFactory || (service ? () => service : (request, fetcher) =>
    createFlightService({ state: flightState, signal: request.signal, now, fetcher }));
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
  return async function handleApi(request, {fetcher} = {}) {
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
          "/api/overview",
          "/api/flights",
          "/api/history",
          "/api/book",
          "/api/itineraries",
        ].includes(url.pathname)
      )
        throw new FlightError(404, "NOT_FOUND", "조회 주소를 찾을 수 없어요.");
      if (url.search.length > (url.pathname === '/api/itineraries' ? 3200 : 600))
        throw new FlightError(400, "INVALID_QUERY", "조회 조건이 너무 깁니다.");
      if (url.pathname === "/api/health")
        return json({ status: "ok", service: "tteum-flights", version: 3 });
      const allowed = {
        "/api/routes": ["origin"],
        "/api/overview": ["origin", "year", "maxLeave", "minNights", "buffer", "page", "month", "sort"],
        "/api/flights": [
          "origin",
          "start",
          "end",
          "minNights",
          "buffer",
          "exact",
          "alternatives",
        ],
        "/api/history": ["origin", "code", "start", "end", "partner"],
        "/api/book": ["origin", "code", "start", "end", "partner"],
        "/api/itineraries": ["origin", "code", "start", "end", "outbound", "refresh"],
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
      const client = await clientKey(request);
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
      // Pending I/O and queue timers belong exclusively to this invocation.
      const service = forRequest(request, fetcher);
      const input = Object.fromEntries(url.searchParams);
      if (url.pathname === '/api/itineraries') {
        const itinerary = itineraryFactory ? itineraryFactory(request) : createItineraryService({state:itineraryState,signal:request.signal,now,fetcher});
        return json(await itinerary.search(input));
      }
      if (url.pathname === "/api/routes")
        return json({ routes: await service.routes(input.origin) });
      if (url.pathname === "/api/overview")
        return json(await service.overview(input));
      if (url.pathname === "/api/flights") {
        if (![undefined,"0","1"].includes(input.alternatives))
          throw new FlightError(400,"INVALID_OPTIONS","일정 비교 조건이 올바르지 않아요.");
        return json(await (input.alternatives === "1" ? service.explore(input) : service.search(input)));
      }
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
      if (url.pathname === "/api/book") {
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
        const wait=error.retryAfter?`${Math.ceil(error.retryAfter/60)}분 후 다시 연결해 주세요.`:'잠시 후 다시 연결하거나 다른 판매처에서 확인해 주세요.';
        const title=status===429?'연결 요청이 잠시 몰렸어요':status>=500?'판매처 연결이 지연되고 있어요':'이 항공권 링크를 확인해 주세요';
        return new Response(
          `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>판매처 연결 안내 · 틈</title><style>body{font-family:system-ui,sans-serif;background:#f5f7fb;color:#172033;margin:0;padding:24px}main{max-width:480px;margin:10vh auto;padding:28px;background:white;border:1px solid #dce4f1;border-radius:20px}h1{font-size:24px}p{font-size:16px;line-height:1.8;color:#4b5c7d}a{display:block;padding:14px;margin-top:12px;border-radius:12px;text-align:center;color:#2453e8;text-decoration:none;border:1px solid #cad5ed}a.primary{background:#2453e8;color:white}a:focus-visible{outline:3px solid #2453e8;outline-offset:3px}</style></head><body><main><h1>${title}</h1><p>${status>=429?wait:'여행 일정을 다시 선택해 주세요.'}</p>${status>=429?`<a class="primary" href="${escape(url.pathname + url.search)}">판매처 다시 연결</a>`:''}${valid?`<a href="${escape(otherSearch)}" rel="noreferrer">같은 날짜로 다른 곳에서 검색</a>`:''}<a href="/">틈으로 돌아가기</a></main></body></html>`,
          {
            status,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              ...(error.retryAfter?{"Retry-After":String(error.retryAfter)}:{}),
              "Referrer-Policy":"no-referrer",
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
