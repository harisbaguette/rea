import test from "node:test";
import assert from "node:assert/strict";
import {
  createFlightService,
  validateSearch,
  normalizeFlight,
  FlightError,
} from "../server/flights.js";
import { createApi } from "../server/api.js";
const NOW = Date.parse("2026-10-14T03:00:00Z");
const input = {
  origin: "ICN",
  start: "2027-09-11",
  end: "2027-09-19",
  minNights: 2,
  buffer: 1,
};
const raw = {
  dep: "ICN",
  arr: "KIX",
  arr_name: "오사카",
  d_date: "20270912",
  a_date: "20270916",
  price: 240000,
  partner: "tripcom",
  ota: {
    at: 1791951438,
    prices: [
      { partner: "tripcom", name: "트립닷컴", price: 240000 },
      { partner: "agoda", name: "아고다", price: 220000 },
    ],
  },
};
const routes = {
  departures: [
    {
      code: "ICN",
      continents: [
        {
          name: "아시아",
          countries: [
            {
              name: "일본",
              code: "JP",
              airports: [{ code: "KIX", name: "오사카(KIX)" }],
            },
          ],
        },
      ],
    },
  ],
};
const reply = (result, status = 200) =>
  new Response(JSON.stringify({ code: "STATUS200", result }), {
    status,
    headers: { "content-type": "application/json" },
  });
function mockFetch(
  searchResult = {
    items: [raw],
    route_stats: { KIX: { avg: 300000 } },
    updated_at: "2026-10-14T03:00:00Z",
    has_next: false,
  },
) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/routes")) return reply(routes);
    return reply(searchResult);
  };
  return { calls, fetcher };
}
test("Workers가 지원하는 요청으로 조회하고 원본 리디렉션은 따라가지 않는다", async () => {
  const mocked = mockFetch();
  const fetcher = async (url, options) => {
    if (options.redirect === "error")
      throw new TypeError('Unsupported redirect mode "error"');
    return mocked.fetcher(url, options);
  };
  const result = await createFlightService({requestSpacingMs:0, fetcher, now: () => NOW }).search(input);
  assert.equal(result.flights.length, 1);
  const redirectService = createFlightService({requestSpacingMs:0,
    fetcher: async () => new Response(null, {status:302,headers:{Location:"https://unexpected.example"}}),
    now: () => NOW,
  });
  await assert.rejects(redirectService.search(input), error => error.status === 502);
});
test("네트워크 실패와 실제 시간 초과를 구분한다", async () => {
  for(const [name,status] of [["TypeError",502],["TimeoutError",504],["AbortError",504]]) {
    const service=createFlightService({requestSpacingMs:0,now:()=>NOW,fetcher:async()=>{const error=new Error("upstream failure");error.name=name;throw error;}});
    await assert.rejects(service.search(input),error=>error.status===status);
  }
});
test("잘못된 공항·날짜·과거·박수를 서버에서 거부한다", () => {
  for (const invalid of [
    { origin: "BAD" },
    { start: "2027-02-30" },
    { end: "2027-09-10" },
    { start: "2026-01-01", end: "2026-01-05" },
    { end: "2027-10-20" },
    { minNights: 0 },
    { minNights: 1.5 },
  ])
    assert.throws(
      () => validateSearch({ ...input, ...invalid }, NOW),
      FlightError,
    );
  assert.equal(
    validateSearch({ ...input, start: "2027-12-25", end: "2027-12-27" }, NOW)
      .empty,
    true,
  );
});
test("동일 목적지의 싼 짧은 일정과 긴 여행을 함께 비교한다", async () => {
  const fetcher=async(url,options)=>{
    if(url.includes('/routes'))return reply(routes);
    const body=JSON.parse(options.body);
    const long=body.date_range.length>0;
    return reply({items:[long?{...raw,d_date:'20270911',a_date:'20270918',price:227900,ota:null}:{...raw,d_date:'20270915',a_date:'20270917',price:220000,ota:null}],route_stats:{KIX:{avg:300000}},updated_at:'2026-10-14T03:00:00Z',has_next:false});
  };
  const result=await createFlightService({requestSpacingMs:0,fetcher,now:()=>NOW}).explore(input);
  assert.equal(result.flights[0].price,220000);
  assert.deepEqual(result.alternatives.KIX.map(f=>[f.nights,f.price,f.leave.length]),[[2,220000,1],[7,227900,2]]);
  assert.equal(result.alternativesStatus,'ready');
});
test("연휴 개요는 실제 운임과 빈 결과·부분 실패를 구분하며 페이지 크기를 제한한다", async()=>{
  const service=createFlightService({requestSpacingMs:0,...mockFetch(),now:()=>NOW});
  const result=await service.overview({origin:'ICN',year:'2027',maxLeave:'2',minNights:'2',buffer:'1',page:'1'});
  assert.equal(result.windows.length,4);
  assert.ok(result.hasNext);
  const first=result.windows[0];
  assert.equal(first.status,'ready');
  assert.equal(first.cheapest.price,220000);
  assert.ok(result.windows.every(w=>['ready','empty','error'].includes(w.status)));
  await assert.rejects(service.overview({year:'2027',page:'10000'}),FlightError);
});
test("긴 일정 조회 실패가 이미 조회한 싼 일정을 없애지 않는다", async()=>{
  const fetcher=async(url,options)=>{
    if(url.includes('/routes'))return reply(routes);
    const body=JSON.parse(options.body);
    if(body.date_range.length) return new Response(null,{status:503});
    return reply({items:[raw],route_stats:{},updated_at:'2026-10-14T03:00:00Z',has_next:false});
  };
  const result=await createFlightService({requestSpacingMs:0,fetcher,now:()=>NOW}).explore(input);
  assert.equal(result.flights.length,1);
  assert.equal(result.alternativesStatus,'partial');
  assert.equal(result.longStayError.code,'UPSTREAM_UNAVAILABLE');
});
test("여러 연휴를 조회해도 원본 동시 요청은 두 개를 넘지 않고 실패 후 슬롯을 돌려준다", async()=>{
  let active=0,maxActive=0,calls=0;
  const fetcher=async()=>{
    active++;maxActive=Math.max(maxActive,active);const index=++calls;
    await new Promise(resolve=>setTimeout(resolve,5));active--;
    if(index===3)throw new TypeError('network failed');
    return reply({items:[],collected_at:'2026-10-14T03:00:00Z'});
  };
  const service=createFlightService({requestSpacingMs:0,fetcher,now:()=>NOW});
  const results=await Promise.allSettled(['KIX','NRT','FUK','DAD','TNA','TAO'].map(code=>service.history({origin:'ICN',code,start:'2027-09-11',end:'2027-09-18',partner:'tripcom'})));
  assert.equal(maxActive,2);assert.equal(results.filter(r=>r.status==='fulfilled').length,5);assert.equal(calls,6);
});
test("해가 바뀌는 연휴를 지난 1월로 잘못 분류하지 않는다", async()=>{
  const service=createFlightService({requestSpacingMs:0,...mockFetch(),now:()=>NOW});
  const result=await service.overview({year:'2026',maxLeave:'1',month:'1'});
  assert.equal(result.totalWindows,0);
});
test("공급처 429 뒤에는 재시도 시간까지 추가 외부 요청을 멈춘다", async()=>{
  let now=NOW,calls=0;
  const service=createFlightService({requestSpacingMs:0,now:()=>now,fetcher:async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'10'}});}});
  const query={origin:'ICN',code:'KIX',start:'2027-09-11',end:'2027-09-18',partner:'tripcom'};
  await assert.rejects(service.history(query),error=>error.retryAfter===10);
  await assert.rejects(service.history({...query,code:'FUK'}),error=>error.status===429);
  assert.equal(calls,1);
  now+=11000;
  await assert.rejects(service.history({...query,code:'FUK'}),error=>error.status===429);
  assert.equal(calls,2);
});
test("상류가 날짜 밖 결과를 반환해도 섞이지 않는다", () => {
  const query = validateSearch(input, NOW);
  assert.equal(
    normalizeFlight({ ...raw, d_date: "20270910" }, {}, {}, query),
    null,
  );
  assert.equal(
    normalizeFlight({ ...raw, a_date: "20270919" }, {}, {}, query),
    null,
  );
  assert.equal(
    normalizeFlight({ ...raw, a_date: "20270912" }, {}, {}, query),
    null,
  );
  assert.equal(normalizeFlight({ ...raw, dep: "PUS" }, {}, {}, query), null);
  assert.equal(
    normalizeFlight({ ...raw, price: NaN, ota: null }, {}, {}, query),
    null,
  );
});
test("실제 판매처 최저·수집평균 비교·복귀여유 연차를 분리한다", () => {
  const flight = normalizeFlight(
    raw,
    { KIX: { avg: 300000 } },
    { KIX: { country: "일본", countryCode: "JP", continent: "아시아" } },
    validateSearch(input, NOW),
  );
  assert.equal(flight.price, 220000);
  assert.equal(flight.partner, "agoda");
  assert.equal(flight.discount, 26.7);
  assert.equal(flight.recoveryEnd, "2027-09-17");
  assert.deepEqual(flight.leave, ["2027-09-13", "2027-09-17"]);
  assert.equal(flight.sellers.length, 2);
  assert.equal(flight.countryCode, "JP");
});
test("익명 요청·연휴 범위·박수·페이지 조회를 정확히 전달한다", async () => {
  const mocked = mockFetch();
  const service = createFlightService({requestSpacingMs:0, ...mocked, now: () => NOW });
  const result = await service.search(input);
  assert.equal(result.flights.length, 1);
  const call = mocked.calls.find((c) => c.url.includes("/search/v2")),
    body = JSON.parse(call.options.body);
  assert.deepEqual(body.trip_date_range, ["20270911", "20270918"]);
  assert.deepEqual(body.nights, [2, 3, 4, 5, 6, 7]);
  assert.equal(body.is_compact, true);
  assert.equal(call.options.headers.Authorization, undefined);
  assert.equal(call.options.headers.Cookie, undefined);
  assert.equal(call.options.headers["X-Device-Id"], undefined);
});
test("날짜 고정은 왕복 날짜 쌍을 보내며 불일치 항공권을 거부한다", async () => {
  const mocked = mockFetch();
  const service = createFlightService({requestSpacingMs:0, ...mocked, now: () => NOW });
  const result = await service.search({ ...input, exact: true });
  assert.equal(result.flights.length, 0);
  const body = JSON.parse(mocked.calls.at(-1).options.body);
  assert.deepEqual(body.date_range, [["20270911", "20270918"]]);
  assert.deepEqual(body.trip_date_range, []);
});
test("동시 동일 조회와 캐시 조회는 외부 호출을 중복하지 않는다", async () => {
  const mocked = mockFetch();
  const service = createFlightService({requestSpacingMs:0, ...mocked, now: () => NOW });
  await Promise.all([
    service.search(input),
    service.search(input),
    service.search(input),
  ]);
  await service.search(input);
  assert.equal(
    mocked.calls.filter((c) => c.url.includes("/search/v2")).length,
    1,
  );
});
test("has_next 페이지를 이어 받고 노선별로 합친다", async () => {
  const calls = [];
  const service = createFlightService({requestSpacingMs:0,
    now: () => NOW,
    fetcher: async (url, options) => {
      if (url.includes("/routes")) return reply(routes);
      const page = JSON.parse(options.body).page;
      calls.push(page);
      return reply({
        items: [{ ...raw, price: page === 1 ? 240000 : 200000, ota: null }],
        route_stats: {},
        has_next: page === 1,
      });
    },
  });
  const result = await service.search(input);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.complete, true);
  assert.equal(result.flights[0].price, 200000);
});
test("상류 시간초과·불량 JSON·실패를 빈 성공으로 바꾸지 않는다", async () => {
  for (const fetcher of [
    async () => {
      throw new Error("network");
    },
    async () => new Response("not json"),
    async () => new Response("down", { status: 503 }),
  ]) {
    const service = createFlightService({requestSpacingMs:0, fetcher, now: () => NOW });
    await assert.rejects(service.search(input), (error) =>
      [502, 504].includes(error.status),
    );
  }
});
test("상류 429는 재시도 시간을 유지한다", async () => {
  const service = createFlightService({requestSpacingMs:0,
    fetcher: async () => new Response(null, { status: 429 }),
    now: () => NOW,
  });
  await assert.rejects(
    service.search(input),
    (error) => error.status === 429 && error.retryAfter === 60,
  );
});
test("갱신 실패 때 이전 운임을 오래된 값으로 표시한다", async () => {
  let time = NOW,
    fail = false;
  const mocked = mockFetch();
  const service = createFlightService({requestSpacingMs:0,
    now: () => time,
    cacheTtl: 100,
    fetcher: (...args) =>
      fail ? Promise.reject(new Error("offline")) : mocked.fetcher(...args),
  });
  await service.search(input);
  time += 200;
  fail = true;
  const result = await service.search(input);
  assert.equal(result.stale, true);
  assert.equal(result.flights[0].price, 220000);
  assert.match(result.warning, /이전 수집 운임/);
});
test("가격 이력의 YYYYMMDD 관측일을 ISO 날짜로 정규화한다", async () => {
  const service = createFlightService({requestSpacingMs:0,
    now: () => NOW,
    fetcher: async () =>
      reply({
        items: [
          { observed_date: "20261013", price: 240000 },
          { observed_date: "20261014", price: 220000 },
          { observed_date: "bad", price: 1 },
        ],
        collected_at: "2026-10-14T03:00:00Z",
      }),
  });
  const history = await service.history({
    origin: "ICN",
    code: "KIX",
    start: "2027-09-12",
    end: "2027-09-16",
    partner: "agoda",
  });
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].date, "2026-10-13");
  assert.equal(history.min, 220000);
});
test("허용 판매처 링크만 HTTPS로 연결한다", async () => {
  const route = {
    origin: "ICN",
    code: "KIX",
    start: "2027-09-12",
    end: "2027-09-16",
    partner: "tripcom",
  };
  for (const url of [
    "https://evil.example/phish",
    "javascript:alert(1)",
    "http://myrealt.rip/insecure",
    "https://app.ac@evil.example",
  ]) {
    const service = createFlightService({requestSpacingMs:0,
      fetcher: async () => reply({ url }),
      now: () => NOW,
    });
    await assert.rejects(
      service.booking(route),
      (error) => error.status === 502,
    );
  }
  const service = createFlightService({requestSpacingMs:0,
    fetcher: async () => reply({ url: "http://app.ac/abc" }),
    now: () => NOW,
  });
  assert.equal((await service.booking(route)).url, "https://app.ac/abc");
});
test("API는 출처·메서드·알 수 없는 필드와 임의 프록시를 거부한다", async () => {
  const api = createApi({
    service: { search: async () => ({ flights: [] }) },
    now: () => NOW,
  });
  for (const [url, options, status] of [
    ["/api/flights?url=https://evil.example", {}, 400],
    ["/api/flights", { method: "POST" }, 405],
    ["/api/flights", { headers: { Origin: "https://evil.example" } }, 403],
    ["/api/other", {}, 404],
  ])
    assert.equal(
      (await api(new Request(`https://tteum.test${url}`, options))).status,
      status,
    );
});
test("API 요청 제한 429와 Retry-After를 반환한다", async () => {
  const api = createApi({
    service: { search: async () => ({ flights: [] }) },
    now: () => NOW,
  });
  let response;
  for (let i = 0; i < 41; i++)
    response = await api(new Request("https://tteum.test/api/flights"));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
});
test("에러 응답은 내부 오류·비밀값을 노출하지 않는다", async () => {
  const api = createApi({
    service: {
      search: async () => {
        throw new Error("secret=should-not-be-exposed");
      },
    },
    now: () => NOW,
  });
  const response = await api(new Request("https://tteum.test/api/flights"));
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("should-not-be-exposed"));
});

test("판매처 주소 생성 실패는 재시도 가능한 HTML과 다른 검색을 제공한다", async () => {
  const api = createApi({
    service: {
      booking: async () => {
        throw new FlightError(502, "BOOKING_UNAVAILABLE", "link down");
      },
    },
    now: () => NOW,
  });
  const response = await api(
    new Request(
      "https://tteum.test/api/book?origin=ICN&code=KIX&start=2027-09-12&end=2027-09-16&partner=tripcom",
    ),
  );
  assert.equal(response.status, 502);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /판매처 다시 연결/);
  assert.match(html, /270912\/270916/);
});
