import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRow,parsePage,googleUrl,readSelection,selectionKey} from '../server/google-wire.js';
import {createItineraryService,createItineraryState,validateItineraryQuery} from '../server/itineraries.js';
import {createApi} from '../server/api.js';
import {tripMetrics,filterItineraries,defaultFlightFilters,pricedOutbound} from '../src/itinerary-math.js';

const outRows=JSON.parse(await readFile(new URL('./fixtures/google-outbound.json',import.meta.url)));
const inRows=JSON.parse(await readFile(new URL('./fixtures/google-return.json',import.meta.url)));
const NOW=Date.parse('2026-10-16T00:00:00Z');
const query={origin:'ICN',code:'NRT',start:'2026-11-05',end:'2026-11-08'};
const html=rows=>`<script>AF_initDataCallback({key: 'ds:1', hash: '7', data:${JSON.stringify([null,null,[rows],[[]]])}, sideChannel: {}});</script>`;
const outbound=parseRow(outRows[0]),inbound=parseRow(inRows[0]);
const reply=rows=>new Response(html(rows),{headers:{'content-type':'text/html'}});

test('실제 공개 응답의 편명·금액·현지시각·UTC offset이 함께 보존된다',()=>{
  assert.equal(outbound.price,421700);assert.equal(outbound.segments[0].number,'1187');assert.equal(outbound.stops,0);
  assert.equal(outbound.segments[0].departure,'2026-11-05T08:35:00+09:00');assert.equal(outbound.durationMinutes,150);
  assert.equal(outbound.baggage,null);assert.equal(inbound.parentTimings[0].number,'1187');
});
test('정각의 생략된 0분을 올바르게 읽는다',()=>{
  const row=outRows.find(r=>r[0]?.[0]==='RS');assert.equal(parseRow(row).segments[0].arrivalLocal,'2026-11-05T19:00:00');
});
test('입력값과 다른 통화·0원·문자열 가격을 현재 운임으로 내보내지 않는다',()=>{
  for(const price of [0,-10,'421700',NaN]){const row=structuredClone(outRows[0]);row[1][0]=[null,price];assert.throws(()=>parseRow(row));}
  const row=structuredClone(outRows[0]);row[1][1]='GgNVU0Q=';assert.throws(()=>parseRow(row));
});
test('토큰의 시간과 공개 구간 시간이 다르면 실제 체류 계산에서 제외한다',()=>{
  const row=structuredClone(outRows[0]);row[0][2][0][8]=[9,35];const f=parseRow(row);
  assert.equal(f.timeVerified,false);assert.equal(f.segments[0].departure,null);
  const noParent={...inbound,parentTimings:null};assert.equal(tripMetrics(f,noParent),null);
});
test('가격 없는 결과는 버리고 파싱 실패·빈 결과·원본 실패를 구별한다',()=>{
  const data=parsePage(html(outRows),{origin:'ICN',destination:'NRT',date:'2026-11-05'});
  assert.equal(data.flights.length,33);assert.equal(data.rejected,4);assert.equal(data.partial,true);
  assert.equal(parsePage(html([]),{origin:'ICN',destination:'NRT',date:'2026-11-05'}).flights.length,0);
  assert.throws(()=>parsePage('<html>challenge</html>',{}),/PAGE_UNAVAILABLE/);
  assert.throws(()=>parsePage(html([[123]]),{}),/PAGE_CHANGED/);
});
test('왕복 운임은 선택한 출국편이 원본 응답에서도 일치할 때만 표시한다',()=>{
  const expected={origin:'NRT',destination:'ICN',date:'2026-11-08',outbound:outbound.selection};
  assert.equal(parsePage(html(inRows),expected).flights[0].price,421700);
  assert.throws(()=>parsePage(html(inRows),{...expected,outbound:[{...outbound.selection[0],number:'9999'}]}),/PAGE_CHANGED/);
});
test('다른 날짜·역방향·목적지 결과를 잘못 합치지 않는다',()=>{
  assert.throws(()=>parsePage(html(outRows),{origin:'ICN',destination:'BKK',date:'2026-11-05'}),/PAGE_CHANGED/);
  assert.throws(()=>parsePage(html(outRows),{origin:'ICN',destination:'NRT',date:'2026-11-06'}),/PAGE_CHANGED/);
});
test('항공편 선택 값은 route/date/carrier/number만 보존하며 임의 URL이 될 수 없다',()=>{
  assert.deepEqual(readSelection(outbound.id),outbound.selection);
  assert.throws(()=>readSelection('https://evil.example'));
  assert.throws(()=>readSelection(selectionKey([{...outbound.selection[0],date:'2026-11-31'}])));
  assert.throws(()=>readSelection(selectionKey([{...outbound.selection[0],number:'x<script>'}])));
  assert.throws(()=>validateItineraryQuery({...query,outbound:selectionKey([{...outbound.selection[0],origin:'LHR'}])},NOW));
  const url=new URL(googleUrl(query,outbound.selection,inbound.selection));assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/travel/flights/booking');
});
test('한국시간 오늘·조회기간·공항·옵션을 서버에서 검증한다',()=>{
  for(const input of [{...query,start:'2026-10-15'},{...query,end:'2026-12-05'},{...query,origin:'ABC'},{...query,code:'<x>'},{...query,refresh:'yes'}])assert.throws(()=>validateItineraryQuery(input,NOW));
  assert.equal(validateItineraryQuery(query,NOW).end,'2026-11-08');
});
test('현재 가격 조회·60초 캐시·재확인 강제 갱신이 동작한다',async()=>{
  let calls=0,time=NOW;const service=createItineraryService({now:()=>time,fetcher:async()=>{calls++;return reply(outRows);}});
  assert.equal((await service.search(query)).flights[0].price,421700);
  assert.equal((await service.search(query)).cached,true);assert.equal(calls,1);
  await service.search({...query,refresh:'1'});assert.equal(calls,2);time+=61000;await service.search(query);assert.equal(calls,3);
});
test('귀국편 응답 가격을 왕복 총액으로 쓰고 출국편 금액을 더하지 않는다',async()=>{
  const service=createItineraryService({now:()=>NOW,fetcher:async(url)=>{assert.match(url,/tfs=/);return reply(inRows);}});
  const result=await service.search({...query,outbound:outbound.id});assert.equal(result.priceType,'roundtrip');assert.equal(result.flights[0].price,421700);assert.match(result.flights[0].bookingUrl,/\/booking\?/);
});
test('원본 403·429 제한은 재시도 반복 없이 60초 휴지기로 전파한다',async()=>{
  let count=0;const service=createItineraryService({now:()=>NOW,fetcher:async()=>{count++;return new Response('',{status:429});}});
  await assert.rejects(()=>service.search(query),e=>e.code==='FLIGHT_SOURCE_BUSY');
  await assert.rejects(()=>service.search(query),e=>e.retryAfter===60);assert.equal(count,1);
});
test('Worker가 지원하는 manual 모드로 요청하며 리다이렉트를 따라가지 않는다',async()=>{
  const service=createItineraryService({now:()=>NOW,fetcher:async(url,options)=>{assert.equal(options.redirect,'manual');return new Response('',{status:302,headers:{location:'https://elsewhere.example'}});}});
  await assert.rejects(()=>service.search(query),e=>e.code==='FLIGHT_SOURCE_UNAVAILABLE');
});
test('동의·인증·구조변경 HTML 및 시간초과를 항공편 없음으로 둔갑시키지 않는다',async()=>{
  for(const fetcher of [async()=>new Response('<html>consent</html>'),async()=>{throw new DOMException('Timeout','TimeoutError');}]){
    const service=createItineraryService({now:()=>NOW,fetcher});await assert.rejects(()=>service.search(query),e=>e.code==='FLIGHT_SOURCE_UNAVAILABLE'&&e.status===502);
  }
});
test('너무 큰 원본 응답을 제한하고 완료 데이터만 공유 상태에 남긴다',async()=>{
  const state=createItineraryState(),service=createItineraryService({state,now:()=>NOW,fetcher:async()=>new Response('x',{headers:{'content-length':String(7*1024*1024)}})});
  await assert.rejects(()=>service.search(query));assert.equal(state.cache.size,0);assert.deepEqual(state.leases,[]);
});
test('새 공개 API도 origin·중복 쿼리·메서드를 제한한다',async()=>{
  let calls=0;const api=createApi({now:()=>NOW,itineraryFactory:()=>({search:async()=>{calls++;return {flights:[]};}})});
  const url='https://tteum.test/api/itineraries?'+new URLSearchParams(query);
  assert.equal((await api(new Request(url))).status,200);
  assert.equal((await api(new Request(url,{headers:{Origin:'https://elsewhere.test'}}))).status,403);
  assert.equal((await api(new Request(url+'&code=BKK'))).status,400);
  assert.equal((await api(new Request(url,{method:'POST'}))).status,405);assert.equal(calls,1);
});
test('실제 체류는 현지 도착부터 귀국편 출발까지이며 한국 도착은 별도다',()=>{
  const m=tripMetrics(outbound,inbound,'2026-11-08T23:59');assert.equal(m.stayMinutes,4295);assert.equal(m.returnAt,'2026-11-08T13:30');assert.equal(m.deadlineMinutes,629);assert.equal(m.daylightMinutes,2255);
});
test('가격에 연결된 출국편 시각이 바뀌면 체류 계산에도 반영한다',()=>{
  const changed=structuredClone(inbound);changed.parentTimings[0].arrival='2026-11-05T12:05:00+09:00';
  assert.equal(tripMetrics(outbound,changed).stayMinutes,4235);assert.equal(pricedOutbound(outbound,changed).segments[0].arrivalLocal,'2026-11-05T12:05:00');
});
test('날짜변경선을 넘는 현지 시간과 한국 익일 귀국을 구분한다',()=>{
  const out={segments:[{arrival:'2026-11-05T08:00:00-08:00',arrivalLocal:'2026-11-05T08:00:00'}]};
  const back={segments:[{departure:'2026-11-07T10:00:00-08:00',departureLocal:'2026-11-07T10:00:00',arrival:'2026-11-08T16:00:00+09:00'}]};
  const m=tripMetrics(out,back,'2026-11-07T23:59');assert.equal(m.stayMinutes,3000);assert.equal(m.returnAt,'2026-11-08T16:00');assert.ok(m.deadlineMinutes<0);
});
test('경유·대기·출도착·공항이동·예산·체류·귀국 마감 필터가 동작한다',()=>{
  const indirect={...inbound,id:'indirect',stops:1,durationMinutes:650,selfTransfer:true,layovers:[{durationMinutes:300,airportChange:true}]};
  for(const f of [{stops:0},{duration:360},{layover:240},{noAirportChange:true},{noSelfTransfer:true}])assert.deepEqual(filterItineraries([inbound,indirect],{...defaultFlightFilters(),...f}).map(x=>x.id),[inbound.id]);
  for(const f of [{budget:400000},{departFrom:'11:00'},{arriveTo:'13:00'},{airline:'KE'},{minStay:72},{deadline:'2026-11-08T13:00'}])assert.equal(filterItineraries([inbound],{...defaultFlightFilters(),...f},{outbound}).length,0);
});
test('서머타임 변경 시 낮 체류 추정치를 단정하지 않는다',()=>{
  const back=structuredClone(inbound);back.parentTimings=null;const out=structuredClone(outbound);out.segments[0].arrival='2026-11-05T11:05:00+08:00';
  assert.equal(tripMetrics(out,back).daylightMinutes,null);
});
test('영국 UTC Z 시각과 중국 경유 3시간 55분을 실제 공개 응답으로 계산한다',async()=>{
  const row=JSON.parse(await readFile(new URL('./fixtures/google-connection.json',import.meta.url))),flight=parseRow(row);
  assert.equal(flight.timeVerified,true);assert.equal(flight.stops,1);assert.equal(flight.layovers[0].airport,'PKX');assert.equal(flight.layovers[0].durationMinutes,235);
  assert.equal(flight.segments[1].arrival,'2026-11-05T17:55:00Z');
});
