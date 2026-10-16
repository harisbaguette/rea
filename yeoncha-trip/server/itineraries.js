import { FlightError, validateSearch } from './flights.js';
import { parsePage, readSelection, googleUrl } from './google-wire.js';

export const createItineraryState = () => ({cache:new Map(), leases:[], cooldown:0});
const TTL = 60000;
const MAX_PAGE = 6 * 1024 * 1024;

export function validateItineraryQuery(input, now=Date.now()) {
  const query=validateSearch({...input,minNights:1,buffer:0,exact:'1'},now);
  if(!/^[A-Z]{3}$/.test(input.code||'') || input.code===query.origin || ![undefined,'0','1'].includes(input.refresh)) throw new FlightError(400,'INVALID_QUERY','공항과 날짜를 다시 확인해 주세요.');
  let outbound=[];
  try { if(input.outbound) outbound=readSelection(input.outbound); }
  catch { throw new FlightError(400,'INVALID_SELECTION','출국편을 다시 선택해 주세요.'); }
  if(outbound.length && (outbound[0].origin!==query.origin || outbound.at(-1).destination!==input.code || outbound[0].date!==query.start || outbound.some(s=>s.date<query.start||s.date>query.end))) throw new FlightError(400,'INVALID_SELECTION','출국편이 선택한 일정과 달라요. 다시 선택해 주세요.');
  return {origin:query.origin,code:input.code,start:query.start,end:query.end,outbound,refresh:input.refresh==='1'};
}

async function readBounded(response) {
  if(Number(response.headers.get('content-length'))>MAX_PAGE) throw new Error('TOO_LARGE');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_PAGE)throw new Error('TOO_LARGE');text+=decoder.decode(value,{stream:true});}return text+decoder.decode(); }
  finally { await reader.cancel().catch(()=>{}); }
}

export function createItineraryService({fetcher=fetch,now=()=>Date.now(),state=createItineraryState(),signal}={}) {
  return {async search(input) {
    const query=validateItineraryQuery(input,now());
    const url=googleUrl(query,query.outbound),key=url;
    const cached=state.cache.get(key);
    if(!query.refresh && cached && cached.until>now()) return {...cached.data,cached:true};
    if(state.cooldown>now()) throw new FlightError(503,'FLIGHT_SOURCE_BUSY','항공편 조회가 잠시 제한됐어요. 잠시 후 다시 조회해 주세요.',Math.ceil((state.cooldown-now())/1000));
    state.leases=state.leases.filter(lease=>lease.until>now());
    if(state.leases.length>=3) throw new FlightError(503,'FLIGHT_SOURCE_BUSY','항공편 조회가 몰렸어요. 잠시 후 다시 조회해 주세요.',5);
    const lease={id:crypto.randomUUID(),until:now()+22000};state.leases.push(lease);
    let phase='fetch', upstreamStatus=null;
    try {
      const abort=AbortSignal.timeout(18000);
      const response=await fetcher(url,{headers:{
        // Public HTML varies by supported browser version; no cookies or tokens.
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Accept':'text/html','Accept-Language':'ko-KR,ko;q=0.9',
      },signal:signal?AbortSignal.any([signal,abort]):abort,redirect:'manual'});
      upstreamStatus=response.status;
      // Workers rejects redirect:'error'. Manual + rejection keeps redirects
      // disabled without relying on Node's broader RequestInit implementation.
      if(response.status>=300 && response.status<400)throw new Error('UPSTREAM_REDIRECT');
      if(response.status===429 || response.status===403){state.cooldown=now()+60000;throw new FlightError(503,'FLIGHT_SOURCE_BUSY','항공편 원본 조회가 잠시 제한됐어요. 잠시 후 다시 조회해 주세요.',60);}
      if(!response.ok)throw new Error('UPSTREAM_ERROR');
      phase='read';const html=await readBounded(response);phase='parse';
      const inbound=query.outbound.length>0;
      const parsed=parsePage(html,{origin:inbound?query.code:query.origin,destination:inbound?query.origin:query.code,date:inbound?query.end:query.start,outbound:query.outbound});
      const observedAt=new Date(now()).toISOString();
      const data={provider:'google-flights',source:'Google 항공편',currency:'KRW',adults:1,cabin:'economy',
        priceType:inbound?'roundtrip':'roundtrip-from',observedAt,expiresAt:new Date(now()+TTL).toISOString(),partial:parsed.partial,
        flights:parsed.flights.map(f=>({...f,...(inbound?{bookingUrl:googleUrl(query,query.outbound,f.selection)}:{})})),
        searchUrl:url,cached:false};
      if(state.cache.size>=32)state.cache.delete(state.cache.keys().next().value);
      state.cache.set(key,{until:now()+TTL,data});
      return data;
    } catch(error) {
      if(error instanceof FlightError)throw error;
      if(signal?.aborted)throw signal.reason;
      console.error(JSON.stringify({event:'itinerary-source-error',phase,upstreamStatus,name:error.name,reason:String(error.message).slice(0,180)}));
      // A challenge, consent page, missing structure or parser error is NOT zero flights.
      if(['PAGE_UNAVAILABLE','PAGE_CHANGED'].includes(error.message))state.cooldown=now()+30000;
      throw new FlightError(502,'FLIGHT_SOURCE_UNAVAILABLE','항공편 정보를 확인하지 못했어요. 다시 조회하거나 원본에서 확인해 주세요.');
    } finally {state.leases=state.leases.filter(item=>item.id!==lease.id);}
  }};
}
