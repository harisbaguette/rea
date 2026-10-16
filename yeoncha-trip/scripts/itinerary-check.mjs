import assert from 'node:assert/strict';
import {openSession} from './access-client.mjs';
import {readPassword} from './access-secret.mjs';
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,i,list)=>value.startsWith('--')?[...pairs,[value.slice(2),list[i+1]]]:pairs,[]));
const {base='https://air.bluekite.co.kr',origin='ICN',code='NRT',start,end}=args;
assert.ok(start&&end,'--start와 --end에 미래의 출국일·귀국편 출발일을 넣으세요.');
const query={origin,code,start,end};
const session=await openSession(base,await readPassword());
try {
async function get(extra={}){
  const r=await fetch(`${base}/api/itineraries?${new URLSearchParams({...query,...extra})}`,{signal:AbortSignal.timeout(25000),headers:{Cookie:session.cookie}});
  const data=await r.json();assert.equal(r.status,200,data.error?.message||'항공편 API 실패');assert.ok(data.flights.length,'확인된 요금 없음');return data;
}
const began=Date.now(),out=await get(),selected=out.flights[0];
assert.equal(selected.segments[0].origin,origin);assert.equal(selected.segments[0].departureLocal.slice(0,10),start);
assert.equal(selected.segments.at(-1).destination,code);
const back=await get({outbound:selected.id}),chosen=back.flights[0];assert.equal(back.priceType,'roundtrip');
assert.deepEqual(chosen.parentTimings.map(s=>[s.origin,s.destination,s.carrier,s.number,s.departure.slice(0,10)]),selected.selection.map(s=>[s.origin,s.destination,s.carrier,s.number,s.date]));
assert.equal(chosen.segments[0].departureLocal.slice(0,10),end);assert.equal(chosen.segments.at(-1).destination,origin);
const fresh=await get({outbound:selected.id,refresh:'1'}),again=fresh.flights.find(f=>f.id===chosen.id);assert.ok(again,'재확인에서 항공편 누락');assert.ok(again.price>0);
const link=new URL(again.bookingUrl);assert.equal(link.origin,'https://www.google.com');assert.equal(link.pathname,'/travel/flights/booking');
console.log(JSON.stringify({at:new Date().toISOString(),base,query,elapsedMs:Date.now()-began,outboundCount:out.flights.length,inboundCount:back.flights.length,
  price:again.price,priceChanged:again.price!==chosen.price,outbound:selected.segments.map(s=>({flight:s.carrier+s.number,departure:s.departure,arrival:s.arrival})),
  inbound:again.segments.map(s=>({flight:s.carrier+s.number,departure:s.departure,arrival:s.arrival})),bookingUrl:again.bookingUrl,checks:'passed'},null,2));
} finally {await session.close();}
