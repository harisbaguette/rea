import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, requiredLeave, daysBetween } from '../src/calendar.js';
import { assessFare, recommendSchedules } from '../src/value.js';

const today = '2026-10-15';
const trip = (start = '2026-12-24', end = '2026-12-27', extra = {}) => ({
  origin: 'ICN', code: 'KIX', start, end, nights: daysBetween(start, end)-1,
  recoveryEnd: end, leave: requiredLeave(start, end), price: 200000, partner: 'tripcom',
  sellers: [{ partner: 'tripcom', name: '트립닷컴', price: 200000 }], ...extra,
});
const overview = (window, price, extra = {}) => ({ ...window, status: 'ready', complete: true, stale: false,
  alternativesStatus: 'ready', cheapest: trip(window.start, window.end, { price, sellers: [{ partner: 'tripcom', price }] }), ...extra });

test('같은 날짜·노선·박수 판매처를 중복 제거하고 유효 정수 가격만 비교한다', () => {
  const flight = trip();
  const result = assessFare(flight, [trip(undefined, undefined, { sellers: [
    { partner: 'tripcom', price: 210000 }, { partner: 'agoda', price: 230000 }, { partner: 'agoda', price: 220000 },
    { partner: 'mrt', price: NaN }, { partner: 'decimal', price: 190000.5 }, { partner: 'string', price: '180000' },
    { partner: 'zero', price: 0 }, { partner: 'negative', price: -1 }, { partner: 'overflow', price: 100000001 },
  ] })]);
  assert.equal(result.status, 'lowest'); assert.equal(result.count, 2);
  assert.equal(result.min, 200000); assert.equal(result.max, 220000); assert.equal(result.savings, 20000);
  assert.deepEqual(result.lowestPartners, ['tripcom']);
  assert.equal(result.scope, '같은 노선·날짜의 판매처 수집가');
});

test('다른 공항·날짜·박수의 가격을 섞지 않으며 판매처가 주장한 다른 날짜도 거른다', () => {
  const flight = trip();
  const cheaper = { partner: 'agoda', price: 100000, sellers: [{ partner: 'agoda', price: 100000 }] };
  const offers = [trip(undefined, undefined, { ...cheaper, origin: 'PUS' }), trip(undefined, undefined, { ...cheaper, code: 'FUK' }),
    trip('2026-12-23', '2026-12-27', cheaper), trip('2026-12-24', '2026-12-28', cheaper), trip(undefined, undefined, { ...cheaper, nights: 2 }),
    trip(undefined, undefined, { sellers: [{ partner: 'agoda', price: 100000, end: '2026-12-28' }] })];
  const result = assessFare(flight, offers);
  assert.equal(result.count, 1); assert.equal(result.status, 'insufficient'); assert.equal(result.savings, 0);
});

test('비교 없음·한 판매처·같은 수집가·더 낮은 판매처·공동 낮은 가격을 구분한다', () => {
  assert.equal(assessFare(trip(undefined, undefined, { partner: '', price: NaN, sellers: [] })).status, 'unavailable');
  assert.equal(assessFare(trip()).status, 'insufficient');
  assert.equal(assessFare(trip(), [trip(undefined, undefined, { partner: 'agoda' })]).status, 'same');
  const higher = assessFare(trip(undefined, undefined, { price: 240000, sellers: [{ partner: 'tripcom', price: 240000 }, { partner: 'agoda', price: 220000 }] }));
  assert.equal(higher.status, 'higher'); assert.equal(higher.savings, 20000);
  const tied = assessFare(trip(), [trip(undefined, undefined, { sellers: [{ partner: 'agoda', price: 200000 }, { partner: 'mrt', price: 220000 }] })]);
  assert.equal(tied.status, 'lowest'); assert.deepEqual(tied.lowestPartners, ['agoda', 'tripcom']);
  assert.doesNotMatch(`${tied.label} ${tied.scope}`, /평소|평균|할인|특가/);
});

test('미래의 실제 연차 조건을 만족하는 일정만 효율순으로 추천한다', () => {
  const weekend = makeWindow('2026-10-17', '2026-10-18');
  const christmas = makeWindow('2026-12-24', '2026-12-27');
  const tooMuchLeave = makeWindow('2026-10-19', '2026-10-23');
  const invalid = { ...weekend, days: 9 };
  const invalidLeave = { ...christmas, leave: [] };
  const result = recommendSchedules([weekend, christmas, tooMuchLeave, makeWindow('2026-10-09', '2026-10-11'), invalid, invalidLeave, christmas], new Map(), { today, maxLeave: 1 });
  assert.equal(result.scope.eligibleCount, 2); assert.equal(result.scope.unloadedCount, 2);
  assert.equal(result.efficient.window.id, christmas.id); assert.equal(result.efficient.efficiency, 4);
  assert.equal(result.efficient.price, null); assert.equal(result.efficient.quoteStatus, 'unloaded');
  assert.equal(result.affordable, null);
});

test('예산 추천은 요금을 확인한 미래 일정만 비교하며 미조회 일정의 싼 가격을 주장하지 않는다', () => {
  const a = makeWindow('2026-10-17', '2026-10-18'), b = makeWindow('2026-10-24', '2026-10-25'), c = makeWindow('2026-12-24', '2026-12-27');
  const map = new Map([[a.id, overview(a, 180000)], [b.id, overview(b, 220000)]]);
  const result = recommendSchedules([a, b, c], map, { today, budget: 200000, maxLeave: 1 });
  assert.equal(result.efficient.window.id, c.id); assert.equal(result.efficient.price, null);
  assert.equal(result.affordable.window.id, a.id); assert.equal(result.affordable.price, 180000);
  assert.deepEqual(result.scope, { eligibleCount: 3, checkedCount: 2, pricedCount: 2, withinBudgetCount: 1, unloadedCount: 1, excludedPriceCount: 0 });
  assert.match(result.affordable.reason, /2개 일정/); assert.doesNotMatch(result.affordable.reason, /전체|모든/);
  assert.equal(recommendSchedules([a, b], map, { today, budget: 100000 }).affordable, null);
});

test('이전 요금·부분 조회·오류·일정 밖 항공권은 요금 추천에서 제외한다', () => {
  const windows = ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21'].map(start => {
    const end = new Date(`${start}T00:00:00Z`); end.setUTCDate(end.getUTCDate()+1);
    return makeWindow(start, end.toISOString().slice(0, 10));
  });
  const variants = [{ stale: true }, { alternativesStatus: 'partial' }, { complete: false }, { status: 'error' },
    { cheapest: trip('2026-12-24', '2026-12-27', { price: 1 }) }, {}];
  const map = new Map(windows.map((window, index) => [window.id, overview(window, index+1, variants[index])]));
  const result = recommendSchedules(windows, map, { today, maxLeave: 0 });
  assert.equal(result.scope.checkedCount, 6); assert.equal(result.scope.pricedCount, 1); assert.equal(result.scope.excludedPriceCount, 5);
  assert.equal(result.affordable.window.id, windows[5].id); assert.equal(result.affordable.price, 6);
  assert.equal(result.affordable.reason, '확인된 요금');
});

test('연차 0·가격과 효율 동률은 유한한 값과 일관된 날짜순으로 처리한다', () => {
  const first = makeWindow('2026-10-17', '2026-10-18'), second = makeWindow('2026-10-24', '2026-10-25');
  const map = new Map([[first.id, overview(first, 200000)], [second.id, overview(second, 200000)]]);
  const result = recommendSchedules([second, first], map, { today, maxLeave: 0 });
  assert.equal(result.efficient.window.id, first.id); assert.equal(result.affordable.window.id, first.id);
  assert.equal(result.efficient.efficiency, 2); assert.equal(result.efficient.reason, '연차 없이 2일 휴가');
  assert.deepEqual(result.ties, { efficient: 2, affordable: 2 }); assert.match(result.affordable.reason, /공동/);
});

test('잘못된 날짜·복귀 여유·연차 정보와 미확인 달력 연도는 추천하지 않는다', () => {
  const valid = makeWindow('2026-10-17', '2026-10-18');
  const invalidWindows = [{ ...valid, start: '2026-02-30' }, { ...valid, leave: ['2026-10-17'] },
    { id: 'unknown', start: '2028-01-01', end: '2028-01-02', days: 2, leave: [] }];
  assert.equal(recommendSchedules(invalidWindows, new Map(), { today }).scope.eligibleCount, 0);
  const map = new Map([[valid.id, overview(valid, 100000, { cheapest: trip(valid.start, valid.end, { recoveryEnd: '2026-10-19', leave: ['2026-10-19'] }) })]]);
  assert.equal(recommendSchedules([valid], map, { today, maxLeave: 1 }).affordable, null);
  assert.equal(recommendSchedules([valid], new Map(), { today: 'invalid' }).efficient, null);
});

test('입력 일정·요금 배열·판매처와 Map을 변경하지 않는다', () => {
  const flight = trip(); const window = makeWindow(flight.start, flight.end);
  const windows = [window], map = new Map([[window.id, overview(window, flight.price)]]), offers = [flight];
  const before = structuredClone({ windows, map, offers });
  assessFare(flight, offers); recommendSchedules(windows, map, { today, maxLeave: 1 });
  assert.deepEqual({ windows, map, offers }, before);
});
