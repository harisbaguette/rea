import {
  addDays,
  daysBetween,
  requiredLeave,
  todayInSeoul,
} from "../src/calendar.js";

export class FlightError extends Error {
  constructor(status, code, message, retryAfter = 0) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
const ORIGINS = new Set(["ICN", "GMP", "PUS", "CJU", "TAE", "CJJ"]);
const PARTNERS = new Set(["tripcom", "agoda", "mrt"]);
const API = "https://api.catchfrog.ai/api/v1";
const dateValid = (value) =>
  /^202[67]-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const ymd = (date) => date.replaceAll("-", "");
const iso = (date) =>
  /^\d{8}$/.test(date || "")
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
    : "";
const fareValid = (value) =>
  Number.isFinite(value) && value > 0 && value <= 100000000;
const safeText = (value, fallback = "") =>
  typeof value === "string" ? value.slice(0, 80) : fallback;
const beachCodes = new Set([
  "OKA",
  "DAD",
  "CXR",
  "PQC",
  "DPS",
  "CEB",
  "KLO",
  "HKT",
  "GUM",
  "SPN",
  "BKI",
  "HNL",
  "CJU",
  "KBV",
  "USM",
]);

export function validateSearch(input, now = Date.now()) {
  const origin = input.origin || "ICN";
  const { start, end } = input;
  if (!ORIGINS.has(origin))
    throw new FlightError(
      400,
      "INVALID_ORIGIN",
      "지원하는 출발 공항을 선택해 주세요.",
    );
  if (
    !dateValid(start) ||
    !dateValid(end) ||
    start < todayInSeoul(new Date(now)) ||
    end <= start ||
    daysBetween(start, end) > 16
  )
    throw new FlightError(
      400,
      "INVALID_DATES",
      "오늘 이후 2026·2027년의 2~16일 여행 일정을 선택해 주세요.",
    );
  const minNights = Number(input.minNights ?? 2);
  if (
    ![undefined, "0", "1", 0, 1].includes(input.buffer) ||
    ![undefined, "0", "1", true, false].includes(input.exact)
  )
    throw new FlightError(
      400,
      "INVALID_OPTIONS",
      "복귀 여유와 날짜 고정 조건이 올바르지 않아요.",
    );
  const buffer = input.buffer === "0" || input.buffer === 0 ? 0 : 1;
  const exact = input.exact === "1" || input.exact === true;
  if (!Number.isInteger(minNights) || minNights < 1 || minNights > 15)
    throw new FlightError(
      400,
      "INVALID_NIGHTS",
      "최소 숙박일은 1~15박으로 선택해 주세요.",
    );
  const lastReturn = addDays(end, -buffer);
  if (daysBetween(start, lastReturn) - 1 < minNights)
    return {
      origin,
      start,
      end,
      minNights,
      buffer,
      exact,
      lastReturn,
      empty: true,
    };
  return {
    origin,
    start,
    end,
    minNights,
    buffer,
    exact,
    lastReturn,
    empty: false,
  };
}

export function normalizeFlight(item, stats = {}, metadata = {}, query) {
  if (!item || item.dep !== query.origin || !/^[A-Z]{3}$/.test(item.arr || ""))
    return null;
  const start = iso(item.d_date),
    end = iso(item.a_date);
  if (
    !dateValid(start) ||
    !dateValid(end) ||
    start < query.start ||
    end > query.lastReturn ||
    start >= end ||
    daysBetween(start, end) - 1 < query.minNights
  )
    return null;
  if (query.exact && (start !== query.start || end !== query.lastReturn))
    return null;
  const sellers = [];
  if (Array.isArray(item.ota?.prices))
    for (const entry of item.ota.prices) {
      if (PARTNERS.has(entry.partner) && fareValid(entry.price))
        sellers.push({
          partner: entry.partner,
          name: safeText(entry.name, entry.partner),
          price: entry.price,
        });
    }
  if (
    PARTNERS.has(item.partner) &&
    fareValid(item.price) &&
    !sellers.some((seller) => seller.partner === item.partner)
  )
    sellers.push({
      partner: item.partner,
      name: { tripcom: "트립닷컴", agoda: "아고다", mrt: "마이리얼트립" }[
        item.partner
      ],
      price: item.price,
    });
  sellers.sort((a, b) => a.price - b.price);
  if (!sellers.length) return null;
  const price = sellers[0].price;
  const average = fareValid(stats[item.arr]?.avg) ? stats[item.arr].avg : null;
  const destination = metadata[item.arr] || {};
  const recoveryEnd = query.buffer ? addDays(end, 1) : end;
  const observedAt =
    Number.isFinite(item.ota?.at) &&
    item.ota.at > 0 &&
    item.ota.at < 8640000000000
      ? new Date(item.ota.at * 1000).toISOString()
      : null;
  return {
    id: `${item.dep}-${item.arr}-${item.d_date}-${item.a_date}`,
    origin: item.dep,
    code: item.arr,
    city: safeText(item.arr_name || destination.name, item.arr).replace(
      /\([A-Z]{3}\)/g,
      "",
    ),
    country: safeText(destination.country, "해외"),
    countryCode: safeText(destination.countryCode),
    continent: safeText(destination.continent, "기타"),
    start,
    end,
    nights: daysBetween(start, end) - 1,
    recoveryEnd,
    leave: requiredLeave(start, recoveryEnd),
    price,
    average,
    discount: average ? Math.round((1 - price / average) * 1000) / 10 : null,
    sellers,
    partner: sellers[0].partner,
    observedAt,
    bestSeason: item.is_best_season === true,
    beach: beachCodes.has(item.arr),
  };
}

export function createFlightService({
  fetcher = globalThis.fetch,
  now = () => Date.now(),
  timeoutMs = 12000,
  cacheTtl = 120000,
} = {}) {
  const cache = new Map(),
    pending = new Map();
  async function cached(key, ttl, loader) {
    const old = cache.get(key),
      current = now();
    if (old && current - old.at < ttl) return { ...old.data, stale: false };
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => {
      try {
        const data = await loader();
        if (cache.size >= 120) cache.delete(cache.keys().next().value);
        cache.set(key, { at: now(), data });
        return { ...data, stale: false };
      } catch (error) {
        if (old && current - old.at < 1800000)
          return {
            ...old.data,
            stale: true,
            warning:
              "새 조회에 실패해 이전 수집 운임을 표시합니다. 판매처에서 현재 가격을 확인해 주세요.",
          };
        throw error;
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, promise);
    return promise;
  }
  async function upstream(path, body) {
    let response;
    try {
      response = await fetcher(`${API}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Market": "kr",
          "X-Platform": "web",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error?.name !== "AbortError" && error?.name !== "TimeoutError")
        throw new FlightError(
          502,
          "UPSTREAM_UNAVAILABLE",
          "운임 제공처에 연결할 수 없어요. 잠시 후 다시 조회해 주세요.",
        );
      throw new FlightError(
        504,
        "UPSTREAM_TIMEOUT",
        "운임 조회가 지연되고 있어요. 잠시 후 다시 조회해 주세요.",
      );
    }
    if (response.status === 429)
      throw new FlightError(
        429,
        "UPSTREAM_LIMIT",
        "조회가 잠시 몰렸어요. 1분 후 다시 시도해 주세요.",
        60,
      );
    if (!response.ok)
      throw new FlightError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "운임 제공처에 연결할 수 없어요. 잠시 후 다시 조회해 주세요.",
      );
    if (Number(response.headers.get("content-length")) > 3000000)
      throw new FlightError(
        502,
        "UPSTREAM_INVALID",
        "운임 응답이 허용 크기를 초과했어요.",
      );
    let data;
    try {
      const reader = response.body.getReader(),
        chunks = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 3000000) {
          await reader.cancel();
          throw new Error("large");
        }
        chunks.push(value);
      }
      const content = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        content.set(chunk, offset);
        offset += chunk.byteLength;
      }
      data = JSON.parse(new TextDecoder().decode(content));
    } catch {
      throw new FlightError(
        502,
        "UPSTREAM_INVALID",
        "운임 응답을 읽을 수 없어요. 다시 조회해 주세요.",
      );
    }
    if (
      data.code !== "STATUS200" ||
      !data.result ||
      typeof data.result !== "object"
    )
      throw new FlightError(
        502,
        "UPSTREAM_INVALID",
        "운임 제공처가 올바른 결과를 반환하지 않았어요.",
      );
    return data.result;
  }
  async function routes(origin = "ICN") {
    if (!ORIGINS.has(origin))
      throw new FlightError(
        400,
        "INVALID_ORIGIN",
        "지원하는 출발 공항을 선택해 주세요.",
      );
    const data = await cached("routes", 21600000, async () => {
      const result = await upstream("/flights/routes?market=kr");
      if (!Array.isArray(result.departures))
        throw new FlightError(
          502,
          "UPSTREAM_INVALID",
          "노선 정보를 읽을 수 없어요.",
        );
      const byOrigin = {};
      for (const dep of result.departures) {
        if (!ORIGINS.has(dep.code)) continue;
        const meta = {};
        for (const continent of dep.continents || [])
          for (const country of continent.countries || [])
            for (const airport of country.airports || []) {
              if (!/^[A-Z]{3}$/.test(airport.code || "")) continue;
              if (meta[airport.code] && continent.name === "인기") continue;
              meta[airport.code] = {
                code: airport.code,
                name: safeText(airport.name),
                country: safeText(country.name),
                countryCode: safeText(country.code),
                continent: safeText(continent.name, "기타"),
              };
            }
        byOrigin[dep.code] = meta;
      }
      return { byOrigin };
    });
    return data.byOrigin[origin] || {};
  }
  async function search(input) {
    const query = validateSearch(input, now());
    const key = `search:${JSON.stringify(query)}`;
    if (query.empty)
      return {
        flights: [],
        query,
        complete: true,
        fetchedAt: new Date(now()).toISOString(),
        updatedAt: null,
        stale: false,
        source: "Catchfrog 공개 운임 조회",
        sourceUrl: "https://catchfrog.ai/",
      };
    return cached(key, cacheTtl, async () => {
      const metadata = await routes(query.origin);
      const flights = [],
        stats = {};
      let complete = false,
        updatedAt = null;
      for (let page = 1; page <= 5; page++) {
        const body = {
          dep: [query.origin],
          arr: [],
          partner: "all",
          month: [],
          nights: Array.from(
            {
              length:
                daysBetween(query.start, query.lastReturn) - query.minNights,
            },
            (_, i) => query.minNights + i,
          ),
          dep_weeks: [],
          date_range: query.exact
            ? [[ymd(query.start), ymd(query.lastReturn)]]
            : [],
          trip_date_range: query.exact
            ? []
            : [ymd(query.start), ymd(query.lastReturn)],
          dep_date_range: [],
          price_range: [],
          page,
          sort: 2,
          is_compact: true,
          is_best_season: false,
          market: "kr",
        };
        const data = await upstream("/flights/search/v2", body);
        if (!Array.isArray(data.items) || data.items.length > 500)
          throw new FlightError(
            502,
            "UPSTREAM_INVALID",
            "항공권 목록 형식이 올바르지 않아요.",
          );
        Object.assign(stats, data.route_stats || {});
        updatedAt =
          typeof data.updated_at === "string" &&
          !Number.isNaN(Date.parse(data.updated_at))
            ? data.updated_at
            : updatedAt;
        for (const item of data.items) {
          const normalized = normalizeFlight(item, stats, metadata, query);
          if (normalized) flights.push(normalized);
        }
        if (data.has_next !== true) {
          complete = true;
          break;
        }
      }
      const unique = new Map();
      for (const flight of flights)
        if (
          !unique.has(flight.code) ||
          unique.get(flight.code).price > flight.price
        )
          unique.set(flight.code, flight);
      return {
        flights: [...unique.values()].sort((a, b) => a.price - b.price),
        query,
        complete,
        fetchedAt: new Date(now()).toISOString(),
        updatedAt,
        source: "Catchfrog 공개 운임 조회",
        sourceUrl: "https://catchfrog.ai/",
      };
    });
  }
  function validateRoute(input) {
    if (
      !ORIGINS.has(input.origin) ||
      !/^[A-Z]{3}$/.test(input.code || "") ||
      !dateValid(input.start) ||
      !dateValid(input.end) ||
      input.end <= input.start ||
      daysBetween(input.start, input.end) > 16 ||
      !PARTNERS.has(input.partner || "tripcom")
    )
      throw new FlightError(
        400,
        "INVALID_FLIGHT",
        "올바른 항공권을 선택해 주세요.",
      );
    return { ...input, partner: input.partner || "tripcom" };
  }
  async function history(input) {
    const route = validateRoute(input);
    return cached(`history:${JSON.stringify(route)}`, 300000, async () => {
      const params = new URLSearchParams({
        dep: route.origin,
        arr: route.code,
        nights: String(daysBetween(route.start, route.end) - 1),
        d_date: ymd(route.start),
        a_date: ymd(route.end),
        partner: route.partner,
        market: "kr",
      });
      const data = await upstream(`/flights/price-history?${params}`);
      const items = (Array.isArray(data.items) ? data.items : [])
        .map((item) => ({
          date: /^\d{8}$/.test(item.observed_date || "")
            ? iso(item.observed_date)
            : item.observed_date,
          price: item.price,
        }))
        .filter(
          (item) =>
            fareValid(item.price) &&
            typeof item.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
            !Number.isNaN(Date.parse(item.date)),
        )
        .slice(-400);
      items.sort((a, b) => a.date.localeCompare(b.date));
      return {
        items,
        min: items.length ? Math.min(...items.map((item) => item.price)) : null,
        max: items.length ? Math.max(...items.map((item) => item.price)) : null,
        collectedAt:
          typeof data.collected_at === "string" ? data.collected_at : null,
        fetchedAt: new Date(now()).toISOString(),
      };
    });
  }
  async function booking(input) {
    const route = validateRoute(input);
    if (route.start < todayInSeoul(new Date(now())))
      throw new FlightError(
        400,
        "PAST_FLIGHT",
        "지난 날짜의 항공권은 예약할 수 없어요.",
      );
    const result = await cached(
      `booking:${JSON.stringify(route)}`,
      300000,
      async () => {
        const payload = {
          partner: route.partner,
          dep_airport: route.origin,
          arr_airport: route.code,
          dep_date: ymd(route.start),
          arr_date: ymd(route.end),
          adults: 1,
          children: 0,
          infants: 0,
          cabin_class: "economy",
          market: "kr",
          source: "yeoncha_trip",
          screen_name: "flight_detail",
          button_name: "seller_link",
        };
        let data = await upstream("/affiliates/links/flights", payload);
        if (typeof data.url !== "string" || !data.url.trim())
          data = await upstream("/affiliates/links/flights", payload);
        let url;
        try {
          url = new URL(data.url);
        } catch {
          throw new FlightError(
            502,
            "INVALID_BOOKING_LINK",
            "판매처 연결 주소를 확인할 수 없어요.",
          );
        }
        if (url.hostname === "app.ac" && url.protocol === "http:")
          url.protocol = "https:";
        if (
          url.protocol !== "https:" ||
          !["app.ac", "myrealt.rip", "agoda.tpm.lv"].includes(url.hostname) ||
          url.username ||
          url.password
        )
          throw new FlightError(
            502,
            "INVALID_BOOKING_LINK",
            "판매처 연결 주소를 확인할 수 없어요.",
          );
        return { url: url.toString() };
      },
    );
    if (result.stale)
      throw new FlightError(
        502,
        "BOOKING_UNAVAILABLE",
        "판매처 연결을 새로 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    return result;
  }
  return { search, routes, history, booking };
}
