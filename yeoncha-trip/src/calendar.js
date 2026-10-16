export const HOLIDAYS = {
  2026: {
    '01-01': '신정', '02-16': '설날 연휴', '02-17': '설날', '02-18': '설날 연휴',
    '03-01': '삼일절', '03-02': '삼일절 대체공휴일', '05-01': '노동절', '05-05': '어린이날',
    '05-24': '부처님오신날', '05-25': '부처님오신날 대체공휴일', '06-03': '지방선거일',
    '06-06': '현충일', '07-17': '제헌절', '08-15': '광복절', '08-17': '광복절 대체공휴일',
    '09-24': '추석 연휴', '09-25': '추석', '09-26': '추석 연휴', '10-03': '개천절',
    '10-05': '개천절 대체공휴일', '10-09': '한글날', '12-25': '크리스마스',
  },
  2027: {
    '01-01': '신정', '02-06': '설날 연휴', '02-07': '설날', '02-08': '설날 연휴',
    '02-09': '설날 대체공휴일', '03-01': '삼일절', '05-01': '노동절',
    '05-03': '노동절 대체공휴일', '05-05': '어린이날', '05-13': '부처님오신날',
    '06-06': '현충일', '07-17': '제헌절', '07-19': '제헌절 대체공휴일',
    '08-15': '광복절', '08-16': '광복절 대체공휴일', '09-14': '추석 연휴',
    '09-15': '추석', '09-16': '추석 연휴', '10-03': '개천절',
    '10-04': '개천절 대체공휴일', '10-09': '한글날', '10-11': '한글날 대체공휴일',
    '12-25': '크리스마스', '12-27': '크리스마스 대체공휴일',
  },
};

const DAY = 86400000;
export const dateOf = (value) => new Date(`${value}T00:00:00Z`);
export const isoDate = (date) => date.toISOString().slice(0, 10);
export const addDays = (value, days) => isoDate(new Date(dateOf(value).getTime() + days * DAY));
export const daysBetween = (start, end) => Math.round((dateOf(end) - dateOf(start)) / DAY) + 1;
export function todayInSeoul(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
}
export function dayInfo(value) {
  const date = dateOf(value);
  const holiday = HOLIDAYS[date.getUTCFullYear()]?.[value.slice(5)] || '';
  const weekend = [0, 6].includes(date.getUTCDay());
  return { date: value, holiday, weekend, off: Boolean(holiday || weekend), weekday: '일월화수목금토'[date.getUTCDay()] };
}
export function rangeDays(start, end) {
  if (!start || !end || end < start) return [];
  return Array.from({ length: daysBetween(start, end) }, (_, i) => dayInfo(addDays(start, i)));
}
export const requiredLeave = (start, end) => rangeDays(start, end).filter((day) => !day.off).map((day) => day.date);
export const shortDate = (date) => `${Number(date.slice(5, 7))}.${Number(date.slice(8))}`;
export function periodLabel(start, end) {
  return `${shortDate(start)} (${dayInfo(start).weekday}) — ${start.slice(0,4)!==end.slice(0,4)?`${end.slice(0,4)}.`:''}${shortDate(end)} (${dayInfo(end).weekday})`;
}
export function makeWindow(start, end) {
  const days = rangeDays(start, end);
  const leave = days.filter((day) => !day.off).map((day) => day.date);
  const holidays = [...new Set(days.filter((day) => day.holiday).map((day) => day.holiday.replace(/ 대체공휴일| 연휴/g, '')))];
  return {
    id: `${start}_${end}`, start, end, days: days.length, leave,
    month: Number(start.slice(5, 7)), title: holidays.length ? holidays.join(' · ') : '주말에 붙여 떠나기',
    efficiency: days.length / Math.max(1, leave.length),
  };
}

// Enumerate full contiguous travel windows. Every weekday without a holiday costs one leave day.
export function findWindows({ year, maxLeave = 2, today = todayInSeoul(), minDays = 2 }) {
  if (!HOLIDAYS[year]) return [];
  const first = `${year}-01-01` > today ? `${year}-01-01` : today;
  const lastStart = `${year}-12-31`;
  const last = HOLIDAYS[year+1] ? `${year+1}-01-15` : lastStart;
  const candidates = [];
  for (let start = first; start <= lastStart; start = addDays(start, 1)) {
    let leave = 0;
    for (let end = start, length = 1; end <= last && length <= 16; end = addDays(end, 1), length++) {
      if (!dayInfo(end).off) leave++;
      if (leave > maxLeave) break;
      if (length >= minDays && length > leave) candidates.push(makeWindow(start, end));
    }
  }
  candidates.sort((a, b) => b.days - a.days || a.leave.length - b.leave.length || a.start.localeCompare(b.start));
  // Keep the best window for each holiday/weekend cluster, while preserving separate nearby holidays.
  const selected = [];
  for (const candidate of candidates) {
    const overlaps = selected.some((win) => {
      const start = win.start > candidate.start ? win.start : candidate.start;
      const end = win.end < candidate.end ? win.end : candidate.end;
      return start <= end && daysBetween(start, end) >= Math.min(win.days, candidate.days) / 2;
    });
    if (!overlaps) selected.push(candidate);
  }
  return selected.sort((a, b) => b.days - a.days || a.leave.length - b.leave.length || a.start.localeCompare(b.start));
}

function icsEscape(value) { return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;'); }
export function calendarFile(window, city = '', now = new Date()) {
  const summary = `틈 여행${city ? ` · ${city}` : ''} · ${window.days}일`;
  const description = `연차 ${window.leave.length}일: ${window.leave.map(shortDate).join(', ') || '사용 없음'}\n항공권과 휴가는 별도로 확정해 주세요.`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TTEUM//Leave Trip//KO', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${window.id}-${city || 'trip'}@tteum.local`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${window.start.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${addDays(window.end, 1).replaceAll('-', '')}`,
    `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(description)}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
