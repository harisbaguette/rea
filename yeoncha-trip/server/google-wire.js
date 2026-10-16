// Google Flights public-page protocol. Based in part on Fli (MIT), Punit Arani.
// See public/assets/licenses/Fli-LICENSE.txt and research/skyscanner-v17/.
// No RPC authentication, browser cookies, challenge solving or proxy rotation.
const encoder = new TextEncoder();
const concat = (...parts) => parts.flat();
function vint(value) {
  const bytes = [];
  do { const low = value % 128; value = Math.floor(value / 128); bytes.push(low + (value ? 128 : 0)); } while (value);
  return bytes;
}
const number = (field, value) => [...vint(field * 8), ...vint(value)];
const message = (field, bytes) => [...vint(field * 8 + 2), ...vint(bytes.length), ...bytes];
const string = (field, value) => message(field, [...encoder.encode(value)]);
const base64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unbase64 = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));

function direction(origin, destination, date, selected = []) {
  return message(3, concat(string(2, date), ...selected.map(segment => message(4, concat(
    string(1, segment.origin), string(2, segment.date), string(3, segment.destination),
    string(5, segment.carrier), string(6, segment.number),
  ))), message(13, concat(number(1, 1), string(2, origin))), message(14, concat(number(1, 1), string(2, destination)))));
}
export function googleUrl(query, outbound = [], inbound = []) {
  const bytes = concat(number(1, 28), number(2, 2), direction(query.origin, query.code, query.start, outbound),
    direction(query.code, query.origin, query.end, inbound), number(8, 1), number(9, 1), number(14, 1),
    inbound.length ? message(16,[8,255,255,255,255,255,255,255,255,255,1]) : [], number(19, 1));
  return `https://www.google.com/travel/flights${inbound.length ? '/booking' : ''}?${new URLSearchParams({hl: 'ko', gl: 'kr', curr: 'KRW', tfs: base64(bytes)})}`;
}
export const selectionFor = flight => flight.segments.map(s => ({origin:s.origin, destination:s.destination, date:s.departureLocal.slice(0,10), carrier:s.carrier, number:s.number}));
export const selectionKey = segments => base64([...encoder.encode(JSON.stringify(segments))]);
export function readSelection(value) {
  if (typeof value !== 'string' || value.length > 2400 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid selection');
  const parsed = JSON.parse(new TextDecoder().decode(unbase64(value)));
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 4) throw new Error('Invalid segments');
  return parsed.map(s => {
    if (!s || !/^[A-Z]{3}$/.test(s.origin) || !/^[A-Z]{3}$/.test(s.destination) || !/^202[67]-\d{2}-\d{2}$/.test(s.date) || !/^[A-Z0-9]{2,3}$/.test(s.carrier) || !/^\d{1,5}[A-Z]?$/.test(s.number)) throw new Error('Invalid segment');
    if (new Date(`${s.date}T00:00:00Z`).toISOString().slice(0,10) !== s.date) throw new Error('Invalid date');
    return {origin:s.origin,destination:s.destination,date:s.date,carrier:s.carrier,number:s.number};
  });
}

function dateTime(date, time) {
  if (!Array.isArray(date) || date.length !== 3 || !Array.isArray(time) || !time.length || ![...date, time[0], time[1] ?? 0].every(Number.isInteger)) throw new Error('Missing date/time');
  const [year, month, day] = date, [hour, minute = 0] = time;
  const result = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || new Date(`${result}Z`).toISOString().slice(0,19) !== result) throw new Error('Invalid date/time');
  return result;
}
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const text = (value, fallback = '') => typeof value === 'string' ? value.slice(0,160) : fallback;

// RFC3339 offsets are included in the public flight-selection token. Keep them
// only when all token timestamps match the visible segments and their durations.
// Never infer a destination's timezone from Korea's clock or a date-only quote.
function timestamps(token, segments) {
  try {
    const packed = JSON.parse(token);
    if (!Array.isArray(packed) || typeof packed[0] !== 'string' || packed[0].length > 12000) return null;
    const decoded = new TextDecoder().decode(unbase64(packed[0]));
    const times = decoded.match(/20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)/g) || [];
    if (times.length !== segments.length * 2) return null;
    return segments.map((s,i) => {
      const departure = times[i*2], arrival = times[i*2+1];
      if (departure.slice(0,19) !== s.departureLocal || arrival.slice(0,19) !== s.arrivalLocal || (Date.parse(arrival)-Date.parse(departure))/60000 !== s.durationMinutes) throw new Error('Mismatched timestamp');
      return {departure, arrival};
    });
  } catch { return null; }
}
function priceCurrency(token) {
  try {
    // Currency is an explicit length-delimited three-character field.
    const bytes = unbase64(token);
    for(let i=0;i<bytes.length-4;i++) if(bytes[i]===26 && bytes[i+1]===3) {
      const currency = String.fromCharCode(...bytes.slice(i+2,i+5));
      if (/^[A-Z]{3}$/.test(currency)) return currency;
    }
  } catch { /* fail closed below */ }
  return null;
}

function fields(bytes) {
  let offset=0;
  const values=new Map();
  function read(){let value=0,shift=0;while(offset<bytes.length&&shift<49){const b=bytes[offset++];value+=(b&127)*2**shift;if(b<128)return value;shift+=7;}throw new Error('Malformed token');}
  while(offset<bytes.length){const tag=read(),field=Math.floor(tag/8),wire=tag%8;let value;
    if(wire===0)value=read();else if(wire===2){const length=read();if(length>bytes.length-offset)throw new Error('Truncated token');value=bytes.slice(offset,offset+length);offset+=length;}else throw new Error('Unsupported token');
    if(!values.has(field))values.set(field,[]);values.get(field).push(value);
  }
  return values;
}
function parentTimings(token) {
  try {
    const parent=JSON.parse(token)?.[1];
    if(!Array.isArray(parent)||parent.length!==1||typeof parent[0]!=='string'||parent[0].length>12000)return null;
    const items=fields(unbase64(parent[0])).get(1);
    if(!items?.length||items.length>4)return null;
    return items.map(item=>{
      const values=fields(item),s=field=>new TextDecoder().decode(values.get(field)?.[0]);
      const result={origin:s(1),departure:s(2),destination:s(3),arrival:s(4),carrier:s(5),number:s(6)};
      if(!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/.test(result.departure)||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/.test(result.arrival)||!(Date.parse(result.arrival)>Date.parse(result.departure)))throw new Error('Invalid selected flight');
      return result;
    });
  }catch{return null;}
}

export function parseRow(row) {
  const detail = row?.[0], raw = detail?.[2], amount = row?.[1]?.[0]?.at(-1);
  if (!Array.isArray(raw) || !raw.length || raw.length > 4 || !integer(amount, 1, 100000000) || priceCurrency(row[1][1]) !== 'KRW') throw new Error('Invalid flight/price');
  const segments = raw.map(s => {
    if (!/^[A-Z]{3}$/.test(s[3]) || !/^[A-Z]{3}$/.test(s[6]) || !/^[A-Z0-9]{2,3}$/.test(s[22]?.[0]) || !/^\d{1,5}[A-Z]?$/.test(s[22]?.[1]) || !integer(s[11], 1, 2000)) throw new Error('Invalid flight segment');
    return {origin:s[3], destination:s[6], originName:text(s[4],s[3]), destinationName:text(s[5],s[6]),
      carrier:s[22][0], number:s[22][1], airline:text(s[22][3], s[22][0]), operatingCarrier:text(s[22][2]) || null,
      departureLocal:dateTime(s[20],s[8]), arrivalLocal:dateTime(s[21],s[10]), durationMinutes:s[11], aircraft:text(s[17]) || null};
  });
  const zoned = timestamps(row[8],segments);
  segments.forEach((s,i) => Object.assign(s, zoned?.[i] || {departure:null,arrival:null}));
  if (!integer(detail[9], 1, 5000)) throw new Error('Invalid journey duration');
  const layovers = segments.slice(1).map((next,i) => {
    const prev = segments[i], airportChange = prev.destination !== next.origin;
    const durationMinutes = prev.arrival && next.departure ? (Date.parse(next.departure)-Date.parse(prev.arrival))/60000 : null;
    if(durationMinutes !== null && !integer(durationMinutes,0,4320)) throw new Error('Invalid connection');
    return {airport:prev.destination, nextAirport:next.origin, name:prev.destinationName, durationMinutes, airportChange,
      overnight:prev.arrivalLocal.slice(0,10)!==next.departureLocal.slice(0,10)};
  });
  if(zoned && (Date.parse(segments.at(-1).arrival)-Date.parse(segments[0].departure))/60000 !== detail[9]) throw new Error('Journey duration mismatch');
  const flight = {segments, layovers, price:amount, currency:'KRW', durationMinutes:detail[9], stops:segments.length-1,
    airline:text(detail[1]?.[0],segments[0].airline), selfTransfer:detail[12] === 1 || detail[12] === true,
    timeVerified:Boolean(zoned), baggage:null,parentTimings:parentTimings(row[8])};
  flight.selection=selectionFor(flight); flight.id=selectionKey(flight.selection);
  return flight;
}

export function parsePage(html, expected) {
  const match = html.match(/AF_initDataCallback\(\{key:\s*'ds:1'[\s\S]*?data:([\s\S]*?), sideChannel:/);
  if (!match) throw new Error('PAGE_UNAVAILABLE');
  const data = JSON.parse(match[1]);
  if (!Array.isArray(data) || data.length < 4) throw new Error('PAGE_CHANGED');
  const rows=[];
  for(const index of [2,3]) {
    if(data[index] == null) continue;
    if(!Array.isArray(data[index]?.[0])) throw new Error('PAGE_CHANGED');
    rows.push(...data[index][0]);
  }
  const flights=[], seen=new Set();let rejected=0;
  for(const row of rows) {
    try {
      const flight=parseRow(row),first=flight.segments[0],last=flight.segments.at(-1);
      if(first.origin!==expected.origin || last.destination!==expected.destination || first.departureLocal.slice(0,10)!==expected.date) throw new Error('Wrong route/date');
      if(expected.outbound?.length) {
        const parents=flight.parentTimings?.map(s=>({origin:s.origin,destination:s.destination,date:s.departure.slice(0,10),carrier:s.carrier,number:s.number}));
        if(!parents||selectionKey(parents)!==selectionKey(expected.outbound))throw new Error('Wrong selected outbound');
      }
      if(!seen.has(flight.id)){flights.push(flight);seen.add(flight.id);}
    } catch { rejected++; }
  }
  if(rows.length && !flights.length) throw new Error('PAGE_CHANGED');
  return {flights:flights.sort((a,b)=>a.price-b.price),partial:rejected>0,rejected};
}
