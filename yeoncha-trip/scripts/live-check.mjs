import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { createFlightService } from "../server/flights.js";
const service = createFlightService();
const results = [];
for (const query of [
  {
    origin: "ICN",
    start: "2027-09-11",
    end: "2027-09-19",
    minNights: 2,
    buffer: 1,
  },
  {
    origin: "PUS",
    start: "2027-02-04",
    end: "2027-02-09",
    minNights: 2,
    buffer: 0,
    exact: true,
  },
]) {
  const start = performance.now(),
    data = await service.search(query);
  assert.ok(
    data.flights.length > 0,
    "실제 공급처에서 항공권이 반환되어야 합니다.",
  );
  for (const flight of data.flights) {
    assert.ok(flight.price > 0);
    assert.ok(flight.start >= query.start);
    assert.ok(flight.end <= data.query.lastReturn);
    assert.ok(flight.nights >= query.minNights);
    if (query.exact) {
      assert.equal(flight.start, query.start);
      assert.equal(flight.end, query.end);
    }
  }
  assert.equal(data.stale, false);
  assert.ok(data.updatedAt);
  results.push({
    query,
    count: data.flights.length,
    complete: data.complete,
    sourceUpdatedAt: data.updatedAt,
    elapsedMs: Math.round(performance.now() - start),
    sample: data.flights
      .slice(0, 2)
      .map((f) => ({
        city: f.city,
        origin: f.origin,
        code: f.code,
        start: f.start,
        end: f.end,
        price: f.price,
        sellers: f.sellers,
      })),
  });
  console.log(
    `실제 운임: ${query.origin} ${query.start}~${query.end}, ${data.flights.length}개 노선, ${Math.round(performance.now() - start)}ms`,
  );
}
const histories = await service.history({
  origin: "ICN",
  code: "PKX",
  start: "2026-12-24",
  end: "2026-12-27",
  partner: "tripcom",
});
assert.ok(
  histories.items.length > 0,
  "공급처의 YYYYMMDD 가격 이력을 표시해야 합니다.",
);
assert.match(histories.items[0].date, /^\d{4}-\d{2}-\d{2}$/);
const booking = await service.booking({
  origin: "ICN",
  code: "PKX",
  start: "2026-12-24",
  end: "2026-12-27",
  partner: "tripcom",
});
assert.equal(new URL(booking.url).protocol, "https:");
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/live-api-check.json",
  JSON.stringify(
    {
      results,
      history: {
        count: histories.items.length,
        min: histories.min,
        max: histories.max,
      },
      booking: { hostname: new URL(booking.url).hostname, https: true },
    },
    null,
    2,
  ),
);
console.log(
  `실제 가격 이력 ${histories.items.length}회 관측, 판매처 HTTPS 연결 주소 생성 확인`,
);
