import {authFetch} from './auth-fetch.js';
import {durationLabel,localTime,localDay,dayOffset,pricedOutbound,tripMetrics,filterItineraries,defaultFlightFilters} from './itinerary-math.js';

export function mountItinerarySearch(root,{flight,availableEnd,budget=0,icon,escape,money}) {
  const query={origin:flight.origin,code:flight.code,start:flight.start,end:flight.end};
  const qs=new URLSearchParams(query);
  const originalUrl=`https://www.google.com/travel/flights?${new URLSearchParams({hl:'ko',curr:'KRW',q:`${query.origin} to ${query.code} round trip ${query.start} to ${query.end}`})}`;
  const filters={outbound:{...defaultFlightFilters(),budget},inbound:{...defaultFlightFilters(),budget,deadline:`${availableEnd||query.end}T23:59`}};
  const results={outbound:null,inbound:null};
  let stage='outbound',outbound=null,inbound=null,busy=true,error='',sort='price',visible=12,controller,serial=0,destroyed=false,refreshUntil=0,changeNotice='';
  const activeFilters=()=>filters[stage==='review'?'inbound':stage];
  const sourceTime=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  const external=(label= 'Google 항공편에서 확인')=>`<a class="button secondary live-external" href="${escape(results[stage]?.searchUrl||originalUrl)}" target="_blank" rel="noopener noreferrer">${label}${icon('external-link')}</a>`;
  const steps=()=>`<ol class="live-steps" aria-label="항공편 선택 단계">${['출국편','귀국편','여정 확인'].map((label,i)=>`<li ${i===['outbound','inbound','review'].indexOf(stage)?'aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join('')}</ol>`;
  function heading(){return `${steps()}<div class="live-title"><div><h3>${stage==='outbound'?'출국편 선택':stage==='inbound'?'귀국편 선택':'선택한 왕복 항공편'}</h3><p>${stage==='outbound'?`${query.origin} → ${query.code} · ${localDay(query.start)}`:stage==='inbound'?`${query.code} → ${query.origin} · ${localDay(query.end)}`:'성인 1인 · 일반석'}</p></div>${stage!=='outbound'?`<button class="text-button" data-live-back>${icon('arrow-left')}${stage==='inbound'?'출국편 변경':'귀국편 변경'}</button>`:''}</div>`;}
  function legLine(f){
    const first=f.segments[0],last=f.segments.at(-1),offset=dayOffset(first.departureLocal,last.arrivalLocal);
    return `<div class="live-leg-line"><div><strong>${localTime(first.departureLocal)}</strong><span>${first.origin}</span></div><div class="live-leg-path"><span>${durationLabel(f.durationMinutes)}</span><i aria-hidden="true">${icon('plane')}</i><span class="${f.stops?'':'live-nonstop'}">${f.stops?`${f.stops}회 경유${f.layovers.length?' · '+f.layovers.map(l=>l.airport).join(', '):''}`:'직항'}</span></div><div><strong>${localTime(last.arrivalLocal)}${offset?`<sup aria-label="${Math.abs(offset)}일 ${offset>0?'뒤':'전'} 도착">${offset>0?'+':''}${offset}</sup>`:''}</strong><span>${last.destination}</span></div></div>`;
  }
  function segmentList(f){
    return `<div class="live-segments">${f.segments.map((s,i)=>`${i?`<div class="live-layover">${icon('clock-3')}<span><strong>${durationLabel(f.layovers[i-1].durationMinutes)} 대기</strong> · ${escape(f.layovers[i-1].name)}${f.layovers[i-1].airportChange?`<b>공항 이동 ${s.origin}</b>`:''}${f.layovers[i-1].overnight?'<b>밤샘 경유</b>':''}</span></div>`:''}<div class="live-segment"><div class="live-segment-route"><span><b>${localDay(s.departureLocal)} ${localTime(s.departureLocal)}</b><span>${escape(s.originName)} <strong>${s.origin}</strong></span></span><span class="live-segment-track" aria-hidden="true"></span><span><b>${localDay(s.arrivalLocal)} ${localTime(s.arrivalLocal)}</b><span>${escape(s.destinationName)} <strong>${s.destination}</strong></span></span></div><p>${escape(s.airline)} · ${escape(s.carrier)} ${escape(s.number)} · ${durationLabel(s.durationMinutes)}${s.operatingCarrier?`<br>운항 ${escape(s.operatingCarrier)}`:''}${s.aircraft?`<br>${escape(s.aircraft)}`:''}</p></div>`).join('')}<p class="live-time-note">각 공항의 현지 시각${f.timeVerified?'':' · 시간대 정보 확인 안 됨'}</p></div>`;
  }
  function chips(f){
    const metrics=outbound&&stage!=='outbound'?tripMetrics(outbound,f,filters.inbound.deadline):null;
    return `<div class="live-trip-chips">${metrics?`<span>${icon('sun')}현지 체류 ${durationLabel(metrics.stayMinutes)}</span>${metrics.stayMinutes<1440?'<span class="live-warning">24시간 미만</span>':''}${metrics.returnAt.slice(0,10)>(availableEnd||query.end)?'<span class="live-warning">휴가 이후 귀국</span>':''}`:''}${f.selfTransfer?'<span class="live-warning">자가 환승</span>':''}${f.layovers.some(l=>l.airportChange)?'<span class="live-warning">공항 이동</span>':''}${f.layovers.some(l=>l.overnight)?'<span class="live-warning">밤샘 경유</span>':''}</div>`;
  }
  function card(f,index){return `<article class="live-flight-card"><div class="live-carrier"><strong>${escape(f.airline)}</strong><span>${f.segments.map(s=>`${escape(s.carrier)} ${escape(s.number)}`).join(' · ')}</span></div>${legLine(f)}${chips(f)}<div class="live-card-bottom"><details><summary>구간 상세${icon('chevron-down')}</summary>${segmentList(f)}</details><button class="live-select" data-live-select="${index}" aria-label="${escape(f.airline)} ${localTime(f.segments[0].departureLocal)} 출발, 왕복 ${money(f.price)}원${stage==='outbound'?'부터, 귀국편 보기':', 여정 확인'}"><span><small>1인 왕복${stage==='outbound'?'부터':''}</small><strong>${money(f.price)}<small>원${stage==='outbound'?'~':''}</small></strong></span>${icon('arrow-right')}</button></div></article>`;}
  function filterPanel(data){
    const f=activeFilters(),airlines=[...new Map(data.flights.flatMap(x=>x.segments.map(s=>[s.carrier,s.airline]))).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
    const choice=(value,label,selected)=>`<option value="${value}" ${String(selected)===String(value)?'selected':''}>${label}</option>`;
    return `<div class="live-toolbar"><div class="live-stop-tabs" role="group" aria-label="경유 횟수">${[[-1,'전체'],[0,'직항'],[1,'1회 이하']].map(([value,label])=>`<button data-live-stops="${value}" aria-pressed="${f.stops===value}">${label}</button>`).join('')}</div><label class="live-sort"><span class="sr-only">항공편 정렬</span><select data-live-sort>${[['price','가격순'],['duration','이동 짧은 순'],...(stage==='inbound'?[['stay','체류 긴 순']]:[['departure','출발 빠른 순']])].map(([v,l])=>choice(v,l,sort)).join('')}</select></label></div><details class="live-filters"><summary>${icon('sliders-horizontal')}시간·항공사 필터${icon('chevron-down')}</summary><form data-live-filters><div class="live-filter-grid"><label>항공사<select name="airline">${choice('','전체',f.airline)}${airlines.map(([v,l])=>choice(v,escape(l),f.airline)).join('')}</select></label><label>왕복 예산<select name="budget">${[[0,'전체'],[200000,'20만원'],[300000,'30만원'],[400000,'40만원'],[600000,'60만원'],[1000000,'100만원']].map(([v,l])=>choice(v,l,f.budget)).join('')}</select></label><fieldset><legend>출발 시각 · 현지</legend><div class="live-time-inputs"><input type="time" name="departFrom" aria-label="가장 이른 출발 시각" value="${f.departFrom}" required><span>–</span><input type="time" name="departTo" aria-label="가장 늦은 출발 시각" value="${f.departTo}" required></div></fieldset><fieldset><legend>도착 시각 · 현지</legend><div class="live-time-inputs"><input type="time" name="arriveFrom" aria-label="가장 이른 도착 시각" value="${f.arriveFrom}" required><span>–</span><input type="time" name="arriveTo" aria-label="가장 늦은 도착 시각" value="${f.arriveTo}" required></div></fieldset><label>최대 이동 시간<select name="duration">${[[0,'전체'],[360,'6시간'],[720,'12시간'],[1440,'24시간']].map(([v,l])=>choice(v,l,f.duration)).join('')}</select></label><label>경유 1회당 최대 대기<select name="layover">${[[0,'전체'],[120,'2시간'],[240,'4시간'],[480,'8시간']].map(([v,l])=>choice(v,l,f.layover)).join('')}</select></label>${stage==='inbound'?`<label>최소 현지 체류<select name="minStay">${[[0,'전체'],[24,'24시간'],[36,'36시간'],[48,'48시간'],[72,'72시간']].map(([v,l])=>choice(v,l,f.minStay)).join('')}</select></label><label>한국 도착 마감<input type="datetime-local" name="deadline" value="${escape(f.deadline)}" min="${query.start}T00:00" max="2028-01-03T23:59"></label>`:''}</div><div class="live-checkboxes"><label><input type="checkbox" name="noAirportChange" ${f.noAirportChange?'checked':''}>공항 이동 제외</label><label><input type="checkbox" name="noSelfTransfer" ${f.noSelfTransfer?'checked':''}>자가 환승 제외</label></div><p class="live-filter-error" role="alert"></p><div class="live-filter-actions"><button type="button" class="text-button" data-live-reset>초기화</button><button class="button primary" type="submit">적용</button></div></form></details>${stage==='inbound'&&f.deadline?`<div class="live-deadline">${icon('calendar-check-2')}한국 ${localDay(f.deadline)} ${localTime(f.deadline)}까지 도착</div>`:''}`;
  }
  function review(){
    const metrics=tripMetrics(outbound,inbound,filters.inbound.deadline),fresh=refreshUntil>Date.now();
    return `<div class="live-review-price"><span>성인 1인 · 왕복 총액</span><strong>${money(inbound.price)}<small>원</small></strong><p>${fresh?'방금 다시 확인한 가격':'선택한 두 항공편의 조회 가격'}</p></div>${changeNotice?`<p class="live-change" role="status">${escape(changeNotice)}</p>`:''}${metrics?`<div class="live-stay"><div>${icon('sun')}<span>현지 체류<strong>${durationLabel(metrics.stayMinutes)}</strong></span></div><div>${icon('plane-landing')}<span>한국 도착<strong>${localDay(metrics.returnAt)} ${localTime(metrics.returnAt)}</strong></span></div>${metrics.daylightMinutes!==null?`<details><summary>낮 시간 약 ${durationLabel(metrics.daylightMinutes)}${icon('chevron-down')}</summary><p>현지 08–22시 중 공항 도착 후 2시간과 귀국편 출발 전 2시간을 뺀 추정치예요. 공항 이동·입국 시간에 따라 달라집니다.</p></details>`:''}</div>${metrics.returnAt.slice(0,10)>(availableEnd||query.end)?'<p class="live-change">선택한 휴가 기간이 끝난 뒤 한국에 도착해요.</p>':''}`:'<p class="live-change">시간대가 확인되지 않아 현지 체류시간을 계산할 수 없어요.</p>'}<div class="live-review-legs">${[['출국',pricedOutbound(outbound,inbound)],['귀국',inbound]].map(([label,f])=>`<section><h4>${icon(label==='출국'?'plane-takeoff':'plane-landing')}${label} · ${localDay(f.segments[0].departureLocal)}</h4>${legLine(f)}<details class="live-review-detail"><summary>${escape(f.airline)} · 구간 상세${icon('chevron-down')}</summary>${segmentList(f)}</details>${f.selfTransfer?'<p class="live-change">자가 환승: 수하물 재수속·입국 조건을 확인하세요.</p>':''}</section>`).join('')}</div><p class="live-baggage">${icon('briefcase-business')}수하물·변경·환불 조건은 판매처에서 확인</p><div class="live-booking">${fresh?`<a class="button primary" data-live-book href="${escape(inbound.bookingUrl)}" target="_blank" rel="noopener noreferrer">${changeNotice?'변경 내용 확인 · 판매처 보기':'Google 항공편에서 판매처 보기'}${icon('external-link')}</a>`:`<button class="button primary" data-live-refresh ${busy?'disabled':''}>${icon('refresh-cw')}${busy?'가격·좌석 다시 확인 중':'현재 가격 다시 확인'}</button>`}<p>결제 전 최종 가격과 수하물 조건을 확인하세요.</p></div>`;
  }
  function render(){
    if(destroyed)return;
    root.setAttribute('aria-busy',String(busy));
    let body='';
    if(stage==='review')body=review();
    else if(busy)body=`<div class="live-loading" role="status"><div class="loading-illustration" aria-hidden="true"><img class="travel-kit" src="/assets/illustrations/travel-kit.webp" width="168" height="176" alt=""><span class="loading-plane">${icon('plane')}</span></div><strong>${stage==='outbound'?'출국편':'귀국편'} 조회 중</strong><span>가격과 운항정보를 함께 확인하고 있어요</span><div class="skeleton"></div></div>`;
    else if(!error){const data=results[stage],list=filterItineraries(data.flights,activeFilters(),{outbound:stage==='inbound'?outbound:null,sort});body=filterPanel(data)+`<div class="live-count" role="status"><span>${list.length}개 항공편</span><span>1인 왕복 · 현지 시각</span></div>`+(list.length?`<div class="live-flight-list">${list.slice(0,visible).map(f=>card(f,data.flights.indexOf(f))).join('')}</div>${visible<list.length?'<button class="button secondary live-more" data-live-more>항공편 더 보기</button>':''}`:`<div class="live-empty"><h4>${data.flights.length?'조건에 맞는 항공편이 없어요':'확인된 항공편이 없어요'}</h4>${data.flights.length?'<button class="button secondary" data-live-reset>필터 초기화</button>':external()}</div>`)+`<p class="live-source">Google 항공편 · ${sourceTime(data.observedAt)} 확인${data.partial?' · 일부 요금 미제공':''}</p>`;}
    if(error)body+=`<div class="live-error" role="alert"><strong>${escape(error)}</strong><button class="button primary" data-live-retry>다시 조회</button>${external()}</div>`;
    root.innerHTML=heading()+body;
  }
  async function request(refresh=false){
    controller?.abort();controller=new AbortController();const id=++serial;
    const params=new URLSearchParams(qs);if(outbound&&stage!=='outbound')params.set('outbound',outbound.id);if(refresh)params.set('refresh','1');
    const response=await authFetch(`/api/itineraries?${params}`,{signal:controller.signal,headers:{Accept:'application/json'}});
    let data;try{data=await response.json();}catch{throw new Error('항공편 연결이 원활하지 않아요. 다시 조회해 주세요.');}
    if(!response.ok)throw new Error(data?.error?.message||'항공편을 확인하지 못했어요.');
    if(id!==serial||destroyed)return null;
    if(!Array.isArray(data.flights))throw new Error('항공편 정보를 확인하지 못했어요.');
    return data;
  }
  async function load(refresh=false){const expected=serial+1;busy=true;error='';render();try{const data=await request(refresh);if(!data)return;results[stage]=data;busy=false;render();}catch(e){if(e.name==='AbortError'||destroyed||expected!==serial)return;busy=false;error=e.message;render();}}
  function focusHeading(){root.querySelector('h3').setAttribute('tabindex','-1');root.querySelector('h3').focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  async function refresh(){
    const expected=serial+1;busy=true;error='';refreshUntil=0;render();
    try{const data=await request(true);if(!data)return;const current=data.flights.find(f=>f.id===inbound.id);busy=false;
      if(!current){error='선택한 항공편의 현재 요금을 찾지 못했어요. 귀국편을 다시 선택해 주세요.';render();return;}
      const changed=inbound.price!==current.price,old=inbound.price,timesChanged=JSON.stringify([inbound.segments,inbound.parentTimings])!==JSON.stringify([current.segments,current.parentTimings]);
      inbound=current;results.inbound=data;refreshUntil=Date.parse(data.expiresAt);changeNotice=changed?`가격이 ${money(old)}원에서 ${money(current.price)}원으로 바뀌었어요.`:timesChanged?'운항 정보가 바뀌었어요. 변경된 시각을 확인하세요.':'';render();
    }catch(e){if(e.name==='AbortError'||destroyed||expected!==serial)return;busy=false;error=e.message;render();}
  }
  function reset(){filters[stage==='review'?'inbound':stage]=defaultFlightFilters();visible=12;render();}
  root.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    if(target.hasAttribute('data-live-select')){const selected=results[stage].flights[Number(target.dataset.liveSelect)];if(!selected)return;visible=12;sort='price';
      if(stage==='outbound'){outbound=selected;inbound=null;results.inbound=null;stage='inbound';load();}else{inbound=selected;stage='review';refreshUntil=0;changeNotice='';render();}focusHeading();
    }else if(target.hasAttribute('data-live-back')){controller?.abort();serial++;busy=false;error='';stage=stage==='review'?'inbound':'outbound';sort='price';visible=12;refreshUntil=0;render();focusHeading();}
    else if(target.hasAttribute('data-live-stops')){activeFilters().stops=Number(target.dataset.liveStops);visible=12;render();}
    else if(target.hasAttribute('data-live-reset'))reset();
    else if(target.hasAttribute('data-live-more')){visible+=12;render();}
    else if(target.hasAttribute('data-live-refresh'))refresh();
    else if(target.hasAttribute('data-live-retry'))stage==='review'?refresh():load(true);
    else if(target.hasAttribute('data-live-book')&&refreshUntil<=Date.now()){event.preventDefault();refreshUntil=0;changeNotice='가격 확인 시간이 지났어요. 한 번 더 확인해 주세요.';render();}
  });
  root.addEventListener('change',event=>{if(event.target.hasAttribute('data-live-sort')){sort=event.target.value;visible=12;render();}});
  root.addEventListener('submit',event=>{
    if(!event.target.hasAttribute('data-live-filters'))return;event.preventDefault();const form=event.target,data=new FormData(form),next={...activeFilters()};
    for(const key of ['airline','departFrom','departTo','arriveFrom','arriveTo','deadline'])if(data.has(key))next[key]=String(data.get(key));
    for(const key of ['budget','duration','layover','minStay'])if(data.has(key))next[key]=Number(data.get(key));
    next.noAirportChange=data.has('noAirportChange');next.noSelfTransfer=data.has('noSelfTransfer');
    if(next.departFrom>next.departTo||next.arriveFrom>next.arriveTo){form.querySelector('.live-filter-error').textContent='시작 시각을 끝 시각보다 앞서 선택해 주세요.';return;}
    filters[stage]=next;visible=12;render();root.querySelector('.live-filters summary')?.focus({preventScroll:true});
  });
  load();
  return ()=>{destroyed=true;serial++;controller?.abort();};
}
