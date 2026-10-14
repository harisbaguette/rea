import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLIDAYS, findWindows, rangeDays, requiredLeave, makeWindow, calendarFile, todayInSeoul } from '../src/calendar.js';
import { DESTINATIONS, filterFlights, searchUrl } from '../src/flights.js';

test('2026·2027년 주 5일 근무 휴일 수가 월력요항과 일치한다', () => {
  assert.equal(rangeDays('2026-01-01', '2026-12-31').filter((day) => day.off).length, 120);
  assert.equal(rangeDays('2027-01-01', '2027-12-31').filter((day) => day.off).length, 119);
  assert.equal(HOLIDAYS[2027]['12-27'], '크리스마스 대체공휴일');
  assert.equal(HOLIDAYS[2027]['07-19'], '제헌절 대체공휴일');
});
test('추석 앞뒤에 연차 2일을 쓰면 9일 연휴를 찾는다', () => {
  const [best] = findWindows({ year: 2027, maxLeave: 2, today: '2026-10-14' });
  assert.equal(best.start, '2027-09-11');
  assert.equal(best.end, '2027-09-19');
  assert.equal(best.days, 9);
  assert.deepEqual(best.leave, ['2027-09-13', '2027-09-17']);
});
test('연차 없이 떠날 수 있는 3일 이상 연휴 10개를 찾는다', () => {
  const windows = findWindows({ year: 2027, maxLeave: 0, today: '2026-10-14' });
  assert.equal(windows.length, 10);
  assert.ok(windows.every((window) => window.leave.length === 0));
  assert.equal(windows[0].days, 4);
});
test('모든 추천은 연차 한도와 현재 날짜, 시작 연도를 지킨다', () => {
  for (const year of [2026, 2027]) for (const maxLeave of [0, 1, 2, 3, 4, 5]) {
    const windows = findWindows({ year, maxLeave, today: '2026-10-14' });
    for (const window of windows) {
      assert.ok(window.start >= '2026-10-14');
      assert.equal(Number(window.start.slice(0, 4)), year);
      assert.ok(Number(window.end.slice(0, 4)) <= year + 1);
      assert.ok(window.leave.length <= maxLeave);
      assert.ok(window.days >= 3 && window.days <= 16);
      assert.deepEqual(window.leave, requiredLeave(window.start, window.end));
    }
  }
  assert.deepEqual(findWindows({ year: 2026, maxLeave: 2, today: '2027-01-01' }), []);
});
test('연말연시 연휴는 해가 바뀌어도 주말·신정을 연결한다', () => {
  const windows=findWindows({year:2026,maxLeave:1,today:'2026-10-14'});
  const newYear=windows.find(w=>w.start==='2026-12-31'&&w.end==='2027-01-03');
  assert.ok(newYear,'연차1일로4일쉬는연말연시기간이추천되어야한다');
  assert.deepEqual(newYear.leave,['2026-12-31']);
  assert.equal(newYear.days,4);
});
test('시간대 경계에서도 한국 날짜로 과거 일정을 판단한다', () => {
  assert.equal(todayInSeoul(new Date('2026-10-13T15:01:00Z')), '2026-10-14');
  assert.equal(todayInSeoul(new Date('2026-10-14T14:59:59Z')), '2026-10-14');
});
test('캘린더 종일 일정은 귀국일 다음 날을 종료일로 쓴다', () => {
  const file = calendarFile(makeWindow('2027-09-11', '2027-09-19'), '오사카', new Date('2026-10-14T00:00:00Z'));
  assert.match(file, /DTSTART;VALUE=DATE:20270911/);
  assert.match(file, /DTEND;VALUE=DATE:20270920/);
  assert.match(file, /SUMMARY:틈 여행 · 오사카 · 9일/);
  assert.ok(file.endsWith('END:VCALENDAR\r\n'));
});
test('선택한 출발 공항과 날짜를 왕복 검색 링크로 정확히 전달한다', () => {
  const url = new URL(searchUrl(DESTINATIONS[0], makeWindow('2027-09-11', '2027-09-19'), 'PUS'));
  assert.equal(url.pathname, '/transport/flights/pus/kix/270911/270919/');
  assert.equal(url.searchParams.get('rtn'), '1');
  assert.equal(url.searchParams.get('currency'), 'KRW');
});
test('실제 조회 목록의 예산·지역·저렴한 운임 필터와 정렬', () => {
  const flights = [
    {code:'KIX',countryCode:'JP',continent:'아시아',price:210000,discount:20,nights:3},
    {code:'DAD',countryCode:'VN',continent:'아시아',price:310000,discount:10,nights:4,beach:true},
    {code:'FUK',countryCode:'JP',continent:'아시아',price:180000,discount:-5,nights:2},
  ];
  assert.deepEqual(filterFlights(flights,{budget:250000,region:'japan',dealsOnly:true}).map(f=>f.code),['KIX']);
  assert.equal(filterFlights(flights,{region:'beach'})[0].code,'DAD');
  assert.equal(filterFlights(flights,{sort:'longest'})[0].code,'DAD');
  assert.equal(filterFlights(flights,{budget:1000}).length,0);
});
