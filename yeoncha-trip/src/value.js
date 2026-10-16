import { HOLIDAYS, daysBetween, requiredLeave } from './calendar.js';

const FARE_SCOPE = '같은 노선·날짜의 판매처 수집가';
const validPrice = value => Number.isSafeInteger(value) && value > 0 && value <= 100000000;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const sameDates = (a, b) => ['origin', 'code', 'start', 'end', 'nights'].every(key => a?.[key] === b?.[key]);
const validTrip = flight => flight && /^[A-Z]{3}$/.test(flight.origin || '')
  && /^[A-Z]{3}$/.test(flight.code || '') && validDate(flight.start) && validDate(flight.end)
  && flight.end > flight.start && Number.isInteger(flight.nights)
  && flight.nights === daysBetween(flight.start, flight.end) - 1;

/** Compare collected seller prices only; neither flight identity nor a historical bargain is established. */
export function assessFare(flight, offers = []) {
  const byPartner = new Map();
  if (validTrip(flight)) {
    for (const offer of [flight, ...(Array.isArray(offers) ? offers : [])]) {
      if (!sameDates(flight, offer)) continue;
      const candidates = [...(Array.isArray(offer.sellers) ? offer.sellers : []), offer];
      for (const seller of candidates) {
        if (!seller || typeof seller.partner !== 'string' || !validPrice(seller.price)) continue;
        if (['origin', 'code', 'start', 'end', 'nights'].some(key => seller[key] !== undefined && seller[key] !== flight[key])) continue;
        const partner = seller.partner.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_-]{0,63}$/.test(partner)) continue;
        const previous = byPartner.get(partner);
        if (!previous || seller.price < previous.price)
          byPartner.set(partner, { partner, name: typeof seller.name === 'string' && seller.name.trim() ? seller.name.trim() : partner, price: seller.price });
      }
    }
  }
  const sellers = [...byPartner.values()].sort((a, b) => a.price-b.price || a.partner.localeCompare(b.partner));
  const count = sellers.length, min = count ? sellers[0].price : null, max = count ? sellers.at(-1).price : null;
  const selectedPrice = validPrice(flight?.price) ? flight.price : null;
  const status = !count ? 'unavailable' : count === 1 ? 'insufficient' : min === max ? 'same'
    : selectedPrice === min ? 'lowest' : selectedPrice > min ? 'higher' : 'unavailable';
  const labels = { unavailable: '비교할 수집가 없음', insufficient: '판매처 비교 부족', same: '판매처 수집가 동일', lowest: '수집 판매처 중 낮은 가격', higher: '더 낮은 판매처 수집가 있음' };
  return { status, min, max, savings: count ? max-min : 0, count, sellers,
    lowestPartners: sellers.filter(seller => seller.price === min).map(seller => seller.partner),
    selectedPrice, label: labels[status], scope: FARE_SCOPE };
}

function validLeave(leave, start, end) {
  if (!Array.isArray(leave) || !HOLIDAYS[start.slice(0, 4)] || !HOLIDAYS[end.slice(0, 4)]) return false;
  const expected = requiredLeave(start, end);
  return leave.length === new Set(leave).size && leave.length === expected.length
    && expected.every(date => leave.includes(date));
}

function eligibleWindow(window, today, maxLeave) {
  return window && validDate(window.start) && validDate(window.end) && window.start >= today
    && window.end > window.start && window.days === daysBetween(window.start, window.end)
    && window.days <= 16 && validLeave(window.leave, window.start, window.end)
    && window.leave.length <= maxLeave;
}

function quoteFor(window, item, maxLeave) {
  if (!item) return { status: 'unloaded', flight: null };
  if (item.start !== window.start || item.end !== window.end) return { status: 'unavailable', flight: null };
  if (item.stale) return { status: 'stale', flight: null };
  if (item.complete !== true || item.alternativesStatus === 'partial') return { status: 'partial', flight: null };
  const flight = item.cheapest, recoveryEnd = flight?.recoveryEnd || flight?.end;
  if (item.status !== 'ready' || !validTrip(flight) || !validPrice(flight.price)
    || flight.start < window.start || flight.end > window.end || !validDate(recoveryEnd)
    || recoveryEnd < flight.end || recoveryEnd > window.end || !validLeave(flight.leave, flight.start, recoveryEnd)
    || flight.leave.length > maxLeave || (window.origin && flight.origin !== window.origin)
    || flight.stale || flight.complete === false || flight.alternativesStatus === 'partial')
    return { status: 'unavailable', flight: null };
  return { status: 'confirmed', flight };
}

/** Rank future calendar windows and, separately, only the fully loaded fresh fare subset. */
export function recommendSchedules(windows, overviewMap, { budget = 0, today, maxLeave = 5 } = {}) {
  const empty = { efficient: null, affordable: null,
    scope: { eligibleCount: 0, checkedCount: 0, pricedCount: 0, withinBudgetCount: 0, unloadedCount: 0, excludedPriceCount: 0 },
    ties: { efficient: 0, affordable: 0 } };
  if (!validDate(today) || !Number.isInteger(maxLeave) || maxLeave < 0 || !Number.isSafeInteger(budget) || budget < 0) return empty;
  const unique = new Map();
  for (const window of Array.isArray(windows) ? windows : [])
    if (eligibleWindow(window, today, maxLeave)) unique.set(`${window.start}_${window.end}`, window);
  const candidates = [...unique.values()].map(window => {
    const item = overviewMap instanceof Map ? overviewMap.get(window.id) : overviewMap?.[window.id];
    const quote = quoteFor(window, item, maxLeave);
    return { window, flight: quote.flight, price: quote.flight?.price ?? null, days: window.days,
      leaveCount: window.leave.length, efficiency: window.days/Math.max(1, window.leave.length),
      quoteStatus: quote.status, withinBudget: quote.flight ? !budget || quote.flight.price <= budget : null };
  });
  const efficientOrder = (a, b) => b.efficiency-a.efficiency || a.leaveCount-b.leaveCount || b.days-a.days
    || a.window.start.localeCompare(b.window.start) || a.window.end.localeCompare(b.window.end);
  const priced = candidates.filter(candidate => candidate.quoteStatus === 'confirmed');
  const withinBudget = priced.filter(candidate => candidate.withinBudget);
  const scope = { eligibleCount: candidates.length, checkedCount: candidates.filter(candidate => candidate.quoteStatus !== 'unloaded').length,
    pricedCount: priced.length, withinBudgetCount: withinBudget.length,
    unloadedCount: candidates.filter(candidate => candidate.quoteStatus === 'unloaded').length,
    excludedPriceCount: candidates.filter(candidate => !['confirmed', 'unloaded'].includes(candidate.quoteStatus)).length };
  const efficient = [...candidates].sort(efficientOrder)[0] || null;
  const affordable = [...withinBudget].sort((a, b) => a.price-b.price || efficientOrder(a, b))[0] || null;
  const ties = { efficient: efficient ? candidates.filter(candidate => candidate.efficiency === efficient.efficiency).length : 0,
    affordable: affordable ? withinBudget.filter(candidate => candidate.price === affordable.price).length : 0 };
  return { efficient: efficient ? { ...efficient, reason: efficient.leaveCount ? `연차 ${efficient.leaveCount}일로 ${efficient.days}일 휴가` : `연차 없이 ${efficient.days}일 휴가` } : null,
    affordable: affordable ? { ...affordable, reason: priced.length === 1 ? `확인된 요금${budget ? ' · 예산 이내' : ''}`
      : `요금 확인 ${priced.length}개 일정 중${ties.affordable > 1 ? ' 공동' : ''} 낮은 수집가${budget ? ' · 예산 이내' : ''}` } : null,
    scope, ties };
}
