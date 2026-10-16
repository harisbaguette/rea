export const durationLabel = minutes => {
  if(!Number.isFinite(minutes)) return '확인 안 됨';
  const n=Math.max(0,Math.floor(minutes));
  return `${Math.floor(n/60)}시간${n%60?` ${n%60}분`:''}`;
};
export const localTime = value => value?.slice(11,16) || '—';
export const localDay = value => value ? `${Number(value.slice(5,7))}.${Number(value.slice(8,10))}` : '';
export const dayOffset = (start,end) => Math.round((Date.parse(`${end.slice(0,10)}T00:00:00Z`)-Date.parse(`${start.slice(0,10)}T00:00:00Z`))/86400000);
export const seoulDateTime = value => value ? new Date(Date.parse(value)+9*3600000).toISOString().slice(0,16) : null;

export function pricedOutbound(outbound,inbound) {
  if(!inbound?.parentTimings || inbound.parentTimings.length!==outbound?.segments.length)return outbound;
  const segments=outbound.segments.map((s,i)=>({...s,...inbound.parentTimings[i],departureLocal:inbound.parentTimings[i].departure.slice(0,19),arrivalLocal:inbound.parentTimings[i].arrival.slice(0,19),durationMinutes:(Date.parse(inbound.parentTimings[i].arrival)-Date.parse(inbound.parentTimings[i].departure))/60000}));
  return {...outbound,segments,timeVerified:true,durationMinutes:(Date.parse(segments.at(-1).arrival)-Date.parse(segments[0].departure))/60000,
    layovers:outbound.layovers.map((l,i)=>({...l,durationMinutes:(Date.parse(segments[i+1].departure)-Date.parse(segments[i].arrival))/60000,overnight:segments[i].arrivalLocal.slice(0,10)!==segments[i+1].departureLocal.slice(0,10)}))};
}

export function tripMetrics(outbound,inbound,deadline='') {
  outbound=pricedOutbound(outbound,inbound);
  const arrived=outbound?.segments?.at(-1),departed=inbound?.segments?.[0],home=inbound?.segments?.at(-1);
  if(!arrived?.arrival || !departed?.departure || !home?.arrival) return null;
  const stayMinutes=(Date.parse(departed.departure)-Date.parse(arrived.arrival))/60000;
  if(stayMinutes<0)return null;
  const returnAt=seoulDateTime(home.arrival);
  const deadlineMinutes=deadline?(Date.parse(`${deadline}:00+09:00`)-Date.parse(home.arrival))/60000:null;
  let daylightMinutes=null;
  // A wall-clock daytime estimate is not reliable across a DST offset change.
  const offset=value=>value.endsWith('Z')?'+00:00':value.slice(-6);
  if(offset(arrived.arrival)===offset(departed.departure)) {
    const from=Date.parse(`${arrived.arrivalLocal}Z`)+120*60000,to=Date.parse(`${departed.departureLocal}Z`)-120*60000;
    daylightMinutes=0;
    for(let day=Math.floor(from/86400000)*86400000;day<=to;day+=86400000) daylightMinutes+=Math.max(0,Math.min(to,day+22*3600000)-Math.max(from,day+8*3600000))/60000;
  }
  return {stayMinutes,daylightMinutes,returnAt,deadlineMinutes};
}

export const defaultFlightFilters = () => ({stops:-1,airline:'',departFrom:'00:00',departTo:'23:59',arriveFrom:'00:00',arriveTo:'23:59',duration:0,layover:0,minStay:0,deadline:'',noAirportChange:false,noSelfTransfer:false,budget:0});
export function filterItineraries(flights,filters,{outbound=null,sort='price'}={}) {
  const result=flights.filter(f=>{
    const first=f.segments[0],last=f.segments.at(-1),depart=localTime(first.departureLocal),arrive=localTime(last.arrivalLocal);
    if(filters.stops>=0&&f.stops>filters.stops)return false;
    if(filters.airline&&!f.segments.every(s=>s.carrier===filters.airline))return false;
    if(depart<filters.departFrom||depart>filters.departTo||arrive<filters.arriveFrom||arrive>filters.arriveTo)return false;
    if(filters.duration&&f.durationMinutes>filters.duration)return false;
    if(filters.layover&&f.layovers.some(l=>l.durationMinutes===null||l.durationMinutes>filters.layover))return false;
    if(filters.noAirportChange&&f.layovers.some(l=>l.airportChange))return false;
    if(filters.noSelfTransfer&&f.selfTransfer)return false;
    if(filters.budget&&f.price>filters.budget)return false;
    if(outbound&&(filters.minStay||filters.deadline)) {
      const metrics=tripMetrics(outbound,f,filters.deadline);
      if(!metrics || (filters.minStay&&metrics.stayMinutes<filters.minStay*60) || (filters.deadline&&metrics.deadlineMinutes<0))return false;
    }
    return true;
  });
  result.sort((a,b)=> sort==='duration'?a.durationMinutes-b.durationMinutes||a.price-b.price:
    sort==='stay'&&outbound?(tripMetrics(outbound,b)?.stayMinutes??-1)-(tripMetrics(outbound,a)?.stayMinutes??-1)||a.price-b.price:
    sort==='departure'?a.segments[0].departureLocal.localeCompare(b.segments[0].departureLocal)||a.price-b.price:a.price-b.price||a.durationMinutes-b.durationMinutes);
  return result;
}
