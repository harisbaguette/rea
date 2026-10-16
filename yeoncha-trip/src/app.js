import {authFetch} from './auth-fetch.js';
import { findWindows, makeWindow, rangeDays, shortDate, periodLabel, daysBetween, calendarFile, todayInSeoul, addDays } from './calendar.js';
import { DESTINATION_IMAGES } from './destination-images.js';
import { DESTINATIONS, ORIGINS, filterFlights, searchUrl, bookUrl } from './flights.js';
import { flagPath } from './countries.js';
import { assessFare, recommendSchedules } from './value.js';
import { mountItinerarySearch } from './itinerary-view.js';
import { airportCatalog, destinationPicker } from './destination-picker.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('ko-KR').format(value);
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${name}"></use></svg>`;
let today=todayInSeoul();
let currentYear=[2026,2027].includes(Number(today.slice(0,4)))?Number(today.slice(0,4)):2027;
const validDate=value=>/^202[67]-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const validRange=(start,end)=>validDate(start)&&validDate(end)&&start>=today&&start<end&&daysBetween(start,end)<=16;
const SORTS={earliest:'가까운 날짜순',price:'확인된 가격순',longest:'휴가가 긴 순',efficiency:'연차 효율순',leave:'연차 적은 순'};
const REGIONS=['all','japan','asia','europe','america','domestic','beach'];
const STORAGE_KEY='tteum.saved.v2';
let storageAvailable=true,detailFlight=null,toastTimer,todayTimer,overviewController,flightController;
let overviewDirty=true,disposeItinerary=null,disposeDestination=null;
let overviewSerial=0,flightSerial=0,restoring=false,suppressDetailClose=0,detailReturnSelector=null,overviewScroll=0;
const queryCache=new Map(),dialogOpeners=new WeakMap();
let calendarMonth=today.slice(0,7),customMonth=today.slice(0,7),customPickingEnd=false;

function stateFromUrl(){
  const p=new URLSearchParams(location.search);
  const number=(key,values,fallback)=>p.has(key)&&values.includes(Number(p.get(key)))?Number(p.get(key)):fallback;
  const start=p.get('start'),end=p.get('end'),selected=validRange(start,end)?makeWindow(start,end):null;
  return {year:number('year',[2026,2027],selected?Number(start.slice(0,4)):currentYear),maxLeave:number('leave',[0,1,2,3,4,5],2),origin:ORIGINS[p.get('origin')]?p.get('origin'):'ICN',month:number('month',Array.from({length:13},(_,i)=>i),0),minNights:number('minNights',[1,2,3,4,5,7],2),buffer:number('buffer',[0,1],1),budget:number('budget',[0,200000,300000,400000,600000],0),region:REGIONS.includes(p.get('region'))?p.get('region'):'all',exact:p.get('exact')==='1',windowSort:SORTS[p.get('windowSort')]?p.get('windowSort'):'earliest',flightSort:p.get('flightSort')==='longest'?'longest':'price',stage:p.get('stage')==='results'||selected||p.has('offer')?'results':'overview',view:p.get('view')==='saved'?'saved':'plan',selected};
}
const state={...stateFromUrl(),allWindows:[],overview:new Map(),overviewState:'idle',overviewError:'',overviewPage:0,windowVisible:4,flights:[],alternatives:{},fareMeta:null,searchState:'idle',searchError:'',resolvedQuery:'',visibleCount:12,saved:[]};
function readSaved(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem('tteum.saved.v1')||'[]';
    const items=JSON.parse(raw);
    return Array.isArray(items)?items.filter(item=>item&&validDate(item.start)&&validDate(item.end)&&item.start<=item.end&&daysBetween(item.start,item.end)<=31&&ORIGINS[item.origin]).slice(0,40).map(item=>{const old=DESTINATIONS.find(d=>d.id===item.destId);return {start:item.start,end:item.end,origin:item.origin,code:/^[A-Z]{3}$/.test(item.code||'')?item.code:old?.code||'',city:String(item.city||old?.city||'').slice(0,80),country:String(item.country||'').slice(0,80),price:Number.isFinite(item.price)?item.price:null,buffer:item.buffer===0?0:1,exact:item.exact===true};}):[];
  }catch(error){if(error.name!=='SyntaxError')storageAvailable=false;return[];}
}
state.saved=readSaved();
function hydrateIcons(root=document){$$('[data-icon]',root).forEach(el=>el.outerHTML=icon(el.dataset.icon));}
function toast(message,undo){
  clearTimeout(toastTimer);const root=$('#toast');root.textContent=message;
  if(undo){const button=document.createElement('button');button.textContent='되돌리기';button.addEventListener('click',undo,{once:true});root.append(button);}
  root.hidden=false;toastTimer=setTimeout(()=>root.hidden=true,undo?8000:3500);
}
function restoreSaved(item,index){if(isSaved(item))return;if(state.saved.length>=40){toast('최대 40개까지 저장할 수 있어요.');return;}state.saved.splice(Math.min(index,state.saved.length),0,item);persistSaved();renderSaved();renderFlights();updateDetailSave();toast('여행을 다시 저장했어요.');}

function sourceTime(value){if(!value||Number.isNaN(Date.parse(value)))return'확인 시각 미제공';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
function syncUrl(push=false){
  if(restoring)return;
  const next=new URLSearchParams();
  const pending=new URLSearchParams(location.search).get('offer');
  const values={year:state.year,leave:state.maxLeave,origin:state.origin,month:state.month,minNights:state.minNights,buffer:state.buffer,budget:state.budget,region:state.region,exact:Number(state.exact),windowSort:state.windowSort,flightSort:state.flightSort,stage:state.stage,view:state.view};
  if(state.stage==='results'&&state.selected){values.start=state.selected.start;values.end=state.selected.end;}
  if(detailFlight){values.offer=`${detailFlight.code}~${detailFlight.start}~${detailFlight.end}`;if(detailFlight.manual)values.manual=1;}
  else if(pending&&(state.searchState==='idle'||state.searchState==='loading')){values.offer=pending;if(new URLSearchParams(location.search).get('manual')==='1')values.manual=1;}
  for(const[key,value]of Object.entries(values))next.set(key,String(value));
  const url=`${location.pathname}?${next}`;
  if(push||url!==`${location.pathname}${location.search}`)history[push?'pushState':'replaceState']({tteum:true,detail:Boolean(detailFlight)},'',url);
}
const savedKey=item=>`${item.origin}|${item.code||''}|${item.start}|${item.end}`;
const isSaved=item=>state.saved.some(entry=>savedKey(entry)===savedKey(item));
const flightItem=f=>({start:f.start,end:f.end,origin:f.origin,code:f.code,city:f.city,country:f.country,price:f.price,buffer:state.buffer});
const scheduleItem=()=>({start:state.selected.start,end:state.selected.end,origin:state.origin,code:'',city:'',buffer:state.buffer,exact:state.exact});
function savedCount(){const count=state.saved.filter(item=>item.start>=today).length;$('#saved-count').textContent=count;$('#saved-count').hidden=count===0;$('#nav-saved').setAttribute('aria-label',`저장한 여행 ${count}개`);}
function persistSaved(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.saved));}catch{storageAvailable=false;}savedCount();}
function toggleSaved(item){
  const active=document.activeElement,selector=active?.dataset.saveOffer?`[data-save-offer="${CSS.escape(active.dataset.saveOffer)}"]`:active?.hasAttribute('data-detail-save')?'[data-detail-save]':active?.hasAttribute('data-save-schedule')?'[data-save-schedule]':null;
  const index=state.saved.findIndex(entry=>savedKey(entry)===savedKey(item));
  if(index>=0){const [removed]=state.saved.splice(index,1);toast('저장을 취소했어요.',()=>restoreSaved(removed,index));}else{if(state.saved.length>=40){toast('최대 40개까지 저장할 수 있어요.');return;}state.saved.unshift(item);toast('저장한 여행에 담았어요.');}
  persistSaved();if(!storageAvailable)toast('브라우저 저장소를 사용할 수 없어 새로고침하면 저장이 사라져요.');
  renderFlights();if(state.view==='saved')renderSaved();updateDetailSave();if(selector)$(selector)?.focus({preventScroll:true});
}
function downloadCalendar(win,city=''){
  const url=URL.createObjectURL(new Blob([calendarFile(win,city)],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`tteum-${win.start}${city?`-${city}`:''}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('캘린더 파일을 내려받았어요.');
}
function rebuildWindows(){state.allWindows=findWindows({year:state.year,maxLeave:state.maxLeave,today,minDays:state.minNights+state.buffer+1});}
function visibleWindows(){
  const windows=state.allWindows.filter(win=>!state.month||win.month===state.month);
  if(state.windowSort==='price')windows.sort((a,b)=>(state.overview.get(a.id)?.cheapest?.price??Infinity)-(state.overview.get(b.id)?.cheapest?.price??Infinity)||a.start.localeCompare(b.start));
  else if(state.windowSort==='longest')windows.sort((a,b)=>b.days-a.days||a.start.localeCompare(b.start));
  else if(state.windowSort==='leave')windows.sort((a,b)=>a.leave.length-b.leave.length||a.start.localeCompare(b.start));
  else if(state.windowSort==='efficiency')windows.sort((a,b)=>b.days/Math.max(1,b.leave.length)-a.days/Math.max(1,a.leave.length)||a.start.localeCompare(b.start));
  else windows.sort((a,b)=>a.start.localeCompare(b.start));
  return windows;
}
function dateBlock(win){const start=rangeDays(win.start,win.start)[0];return `<span class="date-block"><span>${Number(win.start.slice(5,7))}월</span><strong>${Number(win.start.slice(8))}</strong><span>${start.weekday}요일</span></span>`;}
const windowTitle=win=>win.title==='주말에 붙여 떠나기'?'주말 여행':win.title;
function destinationImage(flight){const image=DESTINATION_IMAGES[flight.code],meta=DESTINATIONS.find(d=>d.code===flight.code);return image|| (meta?{src:`/assets/${meta.image}`,alt:meta.alt}:null);}
function thumbnail(flight){const image=destinationImage(flight);return image?`<img class="destination-thumb" src="${image.src}" width="64" height="64" alt="${escape(image.alt)}" loading="lazy">`:`<span class="destination-symbol" aria-hidden="true">${icon('plane')}</span>`;}
function flag(f){const path=flagPath(f.countryCode);return path?`<img class="country-flag" src="${path}" width="24" height="18" alt="" loading="lazy">`:'';}
function country(f){return `<span class="country-label">${flag(f)}<span>${escape(f.country)}</span></span>`;}
function holidayWindows(year=state.year){return findWindows({year,maxLeave:state.maxLeave,today,minDays:3}).filter(w=>w.title!=='주말에 붙여 떠나기');}
function destinationCover(flight){const image=destinationImage(flight);return image?`<div class="destination-cover"><img src="${image.src}" width="640" height="400" alt="${escape(image.alt)}" loading="lazy" decoding="async"></div>`:'';}
function compactPeriod(start,end){return `${shortDate(start)}<span aria-hidden="true">—</span>${shortDate(end)}`;}
function tripChips(win){return `<span class="trip-chips"><span class="trip-chip holiday-chip">${icon('sun')}휴가 ${win.days}일</span><span class="trip-chip leave-chip">${icon('briefcase-business')}연차 ${win.leave.length}일</span></span>`;}
function renderRecommendations(result){
  const root=$('#schedule-recommendations'),item=result.efficient;
  if(!item){root.hidden=true;root.innerHTML='';delete root.dataset.window;return;}root.hidden=false;
  // Preserve the illustration and its one-time entrance while prices stream in.
  if(root.dataset.window===item.window.id)return;
  root.dataset.window=item.window.id;
  root.innerHTML=`<button class="schedule-pick efficient" data-recommend-window="${item.window.id}" aria-label="${escape(windowTitle(item.window))} ${periodLabel(item.window.start,item.window.end)}, 휴가 ${item.days}일, 연차 ${item.leaveCount}일 여행지 보기"><img class="recommendation-mascot" src="/assets/illustrations/cat-traveler.webp" width="86" height="140" alt="" decoding="async"><span class="pick-copy"><span class="pick-label">${escape(windowTitle(item.window))}</span><strong class="pick-date">${icon('calendar-days')}${compactPeriod(item.window.start,item.window.end)}</strong>${tripChips(item.window)}</span><span class="pick-days" aria-hidden="true">${rangeDays(item.window.start,item.window.end).map(d=>`<span class="${d.off?'off':'leave'}"><small>${d.weekday}</small><b>${Number(d.date.slice(8))}</b></span>`).join('')}</span><span class="action-arrow" aria-hidden="true">${icon('arrow-right')}</span></button>`;
}
function fareVerdict(f){
  const value=assessFare(f,allOffers());
  const label=value.count<2?'가격 비교 자료 부족':value.status==='same'?`${value.count}곳 같은 가격`:`${value.count}곳 비교 · ${money(value.savings)}원 차이`;
  return `<button class="fare-verdict" data-detail="${f.id}" aria-label="${escape(f.city)} 가격 비교 근거 보기">${icon(value.count<2?'info':'arrow-up-down')}<span>${label}</span>${icon('chevron-right')}</button>`;
}
function priceEvidence(f){
  const value=assessFare(f,allOffers());
  return `<details class="price-evidence"><summary><span><strong>같은 날짜, 판매처 비교</strong><small>${value.count>1?`${value.count}곳 · ${money(value.savings)}원 차이`:'가격 비교 자료 부족'}</small></span>${icon('chevron-down')}</summary><div class="price-evidence-body">${value.count>1?`<p class="price-conclusion">${value.status==='same'?`확인한 ${value.count}곳의 가격이 같아요`:`판매처 간 최대 <strong>${money(value.savings)}원</strong> 차이`}</p><div class="quote-comparison">${value.sellers.map(s=>`<div><span>${escape(s.name||s.partner)}</span><meter min="0" max="${value.max}" value="${s.price}" aria-label="${escape(s.name||s.partner)} 가격 ${money(s.price)}원"></meter><b>${money(s.price)}원</b></div>`).join('')}</div>`:`<p class="price-conclusion">${value.count===1?'판매처 1곳만 있어 비교가 부족해요':'비교할 판매처 요금이 없어요'}</p>`}<p class="price-scope">같은 노선·날짜의 판매처 가격${value.count>1?` ${value.count}곳 비교`:''}. 항공편·수하물 조건은 다를 수 있어요.</p><p class="price-caveat">평소보다 싼지는 판단할 자료가 없어요. 결제 전 최종 금액과 포함 조건을 확인하세요.</p></div></details>`;
}
const travelKit=()=>'<img class="travel-kit" src="/assets/illustrations/travel-kit.webp" width="168" height="176" alt="" decoding="async">';
function flightLoading(){return `<div class="result-skeleton flight-loading"><div class="loading-illustration" aria-hidden="true">${travelKit()}<span class="loading-plane">${icon('plane')}</span></div><strong>항공권 찾는 중</strong><div class="loading-ticket" aria-hidden="true"><span class="skeleton"></span><span class="skeleton"></span></div></div>`;}
function monthShift(month,delta){const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+delta);return date.toISOString().slice(0,7);}
function monthCells(month,{custom=false,preview=null}={}){
  const first=`${month}-01`,date=new Date(`${first}T12:00:00Z`),start=addDays(first,-date.getUTCDay()),last=monthShift(month,1)+'-01';
  const end=addDays(last,-1),selectedStart=custom?$('#custom-start').value:preview?.start,selectedEnd=custom?$('#custom-end').value:preview?.end;
  const days=rangeDays(start,addDays(end,6-new Date(`${end}T12:00:00Z`).getUTCDay()));
  const opportunities=findWindows({year:Number(month.slice(0,4)),maxLeave:state.maxLeave,today,minDays:2});const bridges=new Set(opportunities.flatMap(win=>win.leave));
  const focusDate=selectedStart?.startsWith(month)?selectedStart:today.startsWith(month)?today:first;
  return `<div class="calendar-weekdays" aria-hidden="true">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid" role="grid" aria-label="${month.replace('-','년 ')}월">${days.map((day,index)=>{
    const outside=day.date.slice(0,7)!==month,disabled=outside||day.date<today||day.date>'2027-12-31',selected=Boolean(selectedStart&&day.date>=selectedStart&&day.date<=(selectedEnd||selectedStart)),leave=selected&&!day.off,bridge=!disabled&&bridges.has(day.date);
    return `${index%7===0?'<div class="calendar-week" role="row">':''}<button type="button" role="gridcell" class="calendar-day ${outside?'outside':''} ${day.holiday?'holiday':''} ${bridge?'bridge-day':''} ${day.off?'off':''} ${selected?'in-range':''} ${leave?'uses-leave':''} ${day.date===selectedStart?'range-start':''} ${day.date===selectedEnd?'range-end':''} ${day.date===today?'is-today':''}" ${disabled?'disabled':''} tabindex="${!disabled&&day.date===focusDate?'0':'-1'}" aria-selected="${selected}" aria-label="${Number(day.date.slice(5,7))}월 ${Number(day.date.slice(8))}일 ${day.weekday}요일${day.holiday?` ${escape(day.holiday)}`:''}${bridge?' 연차로 연휴 연결 가능':leave?' 연차':''}" data-${custom?'custom-day':'calendar-day'}="${day.date}">${Number(day.date.slice(8))}${bridge?'<span class="bridge-mark" aria-hidden="true">+</span>':''}${day.holiday?'<i aria-hidden="true"></i>':''}</button>${index%7===6?'</div>':''}`;
  }).join('')}</div>`;
}
function renderCalendar(preview=state.selected||visibleWindows().find(win=>state.overview.get(win.id)?.status==='ready')||visibleWindows()[0]){
  $('#calendar-month-title').innerHTML=`${Number(calendarMonth.slice(5))}월 <span>${calendarMonth.slice(0,4)}</span>`;
  $('#month-calendar').innerHTML=monthCells(calendarMonth,{preview});
  $('[data-calendar-prev]').disabled=calendarMonth<=today.slice(0,7);$('[data-calendar-next]').disabled=calendarMonth>='2027-12';
  const visible=preview&&preview.start.slice(0,7)<=calendarMonth&&preview.end.slice(0,7)>=calendarMonth;
  $('#calendar-caption').innerHTML=visible?`<strong>${icon('calendar-days')}${shortDate(preview.start)} — ${shortDate(preview.end)}</strong>${tripChips(preview)}`:'<span>날짜 선택</span>';
}
function renderCustomCalendar(){
  $('#custom-calendar-title').textContent=`${customMonth.slice(0,4)}년 ${Number(customMonth.slice(5))}월`;
  $('#custom-calendar').innerHTML=monthCells(customMonth,{custom:true});
  const picks=holidayWindows(Number(customMonth.slice(0,4))).filter(w=>w.start.slice(0,7)<=customMonth&&w.end.slice(0,7)>=customMonth);
  $('#custom-holiday-picks').innerHTML=picks.slice(0,2).map(w=>`<button type="button" data-holiday-range="${w.id}"><span><strong>${escape(windowTitle(w))} · ${w.days}일</strong><small>${periodLabel(w.start,w.end)} · 연차 ${w.leave.length}일</small></span>${icon('arrow-right')}</button>`).join('');
  const upcoming=[...new Map([...holidayWindows(currentYear),...(currentYear===2026?holidayWindows(2027):[])].sort((a,b)=>a.start.localeCompare(b.start)).map(w=>[`${w.title}|${rangeDays(w.start,w.end).find(d=>d.holiday)?.date.slice(0,4)}`,w])).values()].sort((a,b)=>a.start.localeCompare(b.start));
  $('#holiday-shortcuts').innerHTML=upcoming.slice(0,5).map(w=>`<button type="button" data-holiday-month="${rangeDays(w.start,w.end).find(d=>d.holiday)?.date.slice(0,7)||w.start.slice(0,7)}" aria-pressed="${rangeDays(w.start,w.end).find(d=>d.holiday)?.date.slice(0,7)===customMonth}">${escape(windowTitle(w))}</button>`).join('');
  $('[data-custom-prev]').disabled=customMonth<=today.slice(0,7);$('[data-custom-next]').disabled=customMonth>='2027-12';
}
let quickDraft=null,appliedQuickKey='';
function renderQuickControls(){
  const key=`${state.origin}|${state.year}|${state.month}`;
  if(!quickDraft||appliedQuickKey!==key){quickDraft={origin:state.origin,year:state.year,month:state.month};appliedQuickKey=key;}
  $('#quick-origin').value=quickDraft.origin;
  const options=['<option value="custom">직접 날짜 선택</option>'];for(const year of [2026,2027]){if(year<currentYear)continue;options.push(`<option value="${year}-0">${year===currentYear?'올해 남은 연휴':`${year}년 전체`}</option>`);for(let month=year===currentYear?Number(today.slice(5,7)):1;month<=12;month++)options.push(`<option value="${year}-${month}">${year}년 ${month}월</option>`);}
  $('#quick-period').innerHTML=options.join('');$('#quick-period').value=`${quickDraft.year}-${quickDraft.month}`;
  updateSearchButton();
}
function updateSearchButton(){
  const dirty=quickDraft&&(quickDraft.origin!==state.origin||quickDraft.year!==state.year||quickDraft.month!==state.month);
  const busy=state.stage==='results'?['loading','refreshing'].includes(state.searchState):state.overviewState==='loading';
  $('#search-submit').disabled=busy&&!dirty;
  $('#search-submit').setAttribute('aria-busy',String(busy&&!dirty));
  $('.search-toolbar').classList.toggle('has-draft',Boolean(dirty));
  $('#search-submit span').textContent=busy&&!dirty?'검색 중':'검색';
}
function applyQuick(values){
  const samePeriod=values.year===state.year&&values.month===state.month;
  Object.assign(state,values);quickDraft=null;
  if(!samePeriod){state.selected=null;state.stage='overview';state.windowVisible=4;state.overviewPage=0;}
  rebuildWindows();calendarMonth=state.selected?.start.slice(0,7)||`${state.year}-${String(state.month||(state.year===currentYear?Number(today.slice(5,7)):1)).padStart(2,'0')}`;
  renderShell();syncUrl(true);loadOverview();if(state.stage==='results')loadFlights();
}
function overviewCard(win){
  const item=state.overview.get(win.id),flight=item?.cheapest,partial=item?.alternativesStatus==='partial';
  let fare='';
  if(!item)fare=`<span class="window-pending"><span class="skeleton skeleton-price" aria-hidden="true"></span><span>${state.overviewState==='error'?'가격 확인 실패':'가격 확인 중'}</span></span>`;
  else if(item.status==='error')fare=`<span class="window-empty">${icon('circle-alert')}가격 확인 실패</span>`;
  else if(!flight)fare=`<span class="window-empty">항공권 없음</span>`;
  else fare=`<span class="window-offer"><span class="window-preview"><b>${flag(flight)}${escape(flight.city)}</b><span class="card-arrow" aria-hidden="true">${icon('arrow-up-right')}</span></span><span class="window-fare"><strong>${money(flight.price)}<small>원</small></strong></span><span class="window-country">${escape(flight.country)} · 1인 왕복</span><span class="window-itinerary">${icon('plane')}<span><span class="sr-only">출발일·귀국편 출발일 </span>${shortDate(flight.start)} — ${shortDate(flight.end)}</span></span></span>`;
  return `<button class="window-option ${state.selected?.id===win.id?'selected':''} ${win.title!=='주말에 붙여 떠나기'?'holiday-window':''}" data-window="${win.id}" aria-label="${escape(windowTitle(win))} ${periodLabel(win.start,win.end)}, 휴가 ${win.days}일, 연차 ${win.leave.length}일${flight?`, ${escape(flight.country)} ${escape(flight.city)} 왕복 ${money(flight.price)}원`:''}"><span class="window-header"><span class="window-label">${escape(windowTitle(win))}</span><span class="window-schedule">${icon('calendar-days')}<strong>${compactPeriod(win.start,win.end)}</strong></span>${tripChips(win)}</span>${fare}${partial?`<span class="window-warning">${icon('circle-alert')}긴 일정 조회 실패</span>`:''}${item?.stale?'<span class="window-warning">이전 가격</span>':''}${flight&&state.budget&&flight.price>state.budget?'<span class="window-warning">선택 예산 초과</span>':''}</button>`;
}

function renderOverview(){
  const focus=document.activeElement,activeId=focus?.dataset.window,activeRecommendation=focus?.dataset.recommendWindow,activeMore=focus?.hasAttribute('data-more-windows');
  const windows=visibleWindows(),checked=windows.filter(win=>state.overview.has(win.id)),errors=checked.filter(win=>{const item=state.overview.get(win.id);return item?.status==='error'||item?.alternativesStatus==='partial';});
  $('#search-context').innerHTML=`${icon('plane-takeoff')}<span>${ORIGINS[state.origin]} · ${state.month?`${state.year}.${state.month}`:state.year}</span>`;
  updateSearchButton();
  const recommendation=recommendSchedules(windows,state.overview,{budget:state.budget,today,maxLeave:state.maxLeave});
  renderRecommendations(recommendation);
  const pending=state.overviewState==='loading'||state.overviewState==='error';
  $('#overview-loading').hidden=!pending;$('#overview-loading').classList.toggle('is-searching',state.overviewState==='loading');
  $('#loading-caption').textContent=state.overviewState==='error'?'요금 확인 실패':'가격 확인 중';
  $('#overview-status').textContent=state.overviewState==='error'?state.overviewError:`${checked.length}/${windows.length} 요금 확인${state.overviewState==='loading'?' 중':''}${errors.length?` · ${errors.length}개 일부 실패`:''}`;
  $('#current-window-sort').textContent=SORTS[state.windowSort];
  $('#overview-retry').hidden=state.overviewState!=='error'&&!errors.length;
  $('#window-list').setAttribute('aria-busy',String(state.overviewState==='loading'));
  const shown=windows.slice(0,state.windowVisible),unpriced=shown.filter(win=>state.overview.get(win.id)?.status==='empty');
  const overBudget=shown.filter(win=>state.budget&&state.overview.get(win.id)?.cheapest?.price>state.budget);
  const available=shown.filter(win=>state.overview.get(win.id)?.status!=='empty'&&!overBudget.includes(win));
  $('#window-list').innerHTML=windows.length?available.length?available.map(win=>overviewCard(win,recommendation)).join(''):overBudget.length?`<div class="empty">${icon('wallet')}<h2>확인한 일정은 예산을 넘어요</h2><p>왕복 ${money(state.budget)}원 이하 · 다른 일정도 확인해 보세요.</p><button class="text-button" data-reset-budget>예산 제한 해제</button></div>`:'':`<div class="empty">${icon('calendar')}<h2>이 조건으로 갈 수 있는 일정이 없어요</h2><p>${state.minNights}박${state.buffer?' + 복귀 여유 하루':''}가 필요한 조건입니다. 연차를 늘리거나 더 짧은 여행을 찾아보세요.</p><button class="button primary" data-relax-nights>1박·복귀 여유 없이 다시 찾기</button><button class="text-button" data-open-settings>조건 바꾸기</button><button class="text-button" data-open-custom>직접 날짜 선택</button></div>`;
  $('#unpriced-windows').innerHTML=unpriced.length?`<details class="unpriced-list" ${unpriced.some(win=>win.id===activeId)?'open':''}><summary>가격 없는 일정 ${unpriced.length}개</summary>${unpriced.map(win=>`<button class="unpriced-option" data-window="${win.id}"><span>${escape(win.title)} · ${periodLabel(win.start,win.end)}</span>${icon('chevron-right')}</button>`).join('')}</details>`:'';
  if(overBudget.length)$('#unpriced-windows').innerHTML+=`<details class="unpriced-list"><summary>예산을 넘는 일정 ${overBudget.length}개</summary>${overBudget.map(win=>`<button class="unpriced-option" data-window="${win.id}"><span>${periodLabel(win.start,win.end)} · ${money(state.overview.get(win.id).cheapest.price)}원</span>${icon('chevron-right')}</button>`).join('')}</details>`;
  $('#more-windows').innerHTML=windows.length>state.windowVisible?`<button class="button secondary full" data-more-windows ${state.overviewState==='loading'?'disabled':''}>연휴 더 보기 ${icon('chevron-down')}</button>`:'';
  if(activeId)$(`[data-window="${CSS.escape(activeId)}"]`)?.focus({preventScroll:true});else if(activeRecommendation)$(`[data-recommend-window="${CSS.escape(activeRecommendation)}"]`)?.focus({preventScroll:true});else if(activeMore)$('[data-more-windows]')?.focus({preventScroll:true});
}
function updateFilterCount(){
  const filters=Number(state.budget>0)+Number(state.minNights!==2)+Number(state.buffer!==1)+Number(state.region!=='all')+Number(state.exact)+Number(state.maxLeave!==2);
  $('#filter-count').textContent=filters;$('#filter-count').hidden=!filters;
}
function renderShell(){
  const onPlan=state.view==='plan';$('#plan-view').hidden=!onPlan;$('#plan-view').dataset.stage=state.stage;$('#saved-view').hidden=onPlan;
  $('#nav-home').toggleAttribute('aria-current',onPlan);if(onPlan)$('#nav-home').setAttribute('aria-current','page');$('#nav-saved').toggleAttribute('aria-current',!onPlan);if(!onPlan)$('#nav-saved').setAttribute('aria-current','page');
  $('#planner').hidden=state.stage!=='overview';$('#trip-results').hidden=state.stage!=='results';
  $('#condition-summary').textContent=`${ORIGINS[state.origin]} · 연차 최대 ${state.maxLeave}일 · ${state.minNights}박 이상${state.buffer?' · 복귀 여유 하루':' · 복귀 여유 없음'}`;
  $('#today-caption').textContent=state.year===currentYear?`오늘 ${shortDate(today)} 이후`:`${state.year}년 · 연차 최대 ${state.maxLeave}일`;
  $('#planner-heading').textContent='떠나기 좋은 연휴';
  updateFilterCount();
  $('#year-tabs').innerHTML=[2026,2027].map(year=>`<button data-year="${year}" aria-pressed="${state.year===year}">${year===currentYear?'올해 남은 연휴':`${year}년 미리보기`}</button>`).join('');
  $('#flight-sort').value=state.flightSort;
  $$('#region-tabs button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.region===state.region)));
  renderQuickControls();renderCalendar();renderOverview();renderSelected();renderFlights();if(!onPlan)renderSaved();savedCount();
}
async function fetchJson(url,signal){
  let response,data;
  try{response=await authFetch(url,{signal,headers:{Accept:'application/json'}});data=await response.json();}
  catch(error){if(error.name==='AbortError')throw error;throw new Error(navigator.onLine===false?'인터넷 연결을 확인하고 다시 시도해 주세요.':'연결이 원활하지 않아요. 잠시 후 다시 조회해 주세요.');}
  if(!response.ok)throw new Error(data?.error?.message||'연결이 원활하지 않아요. 잠시 후 다시 조회해 주세요.');
  return data;
}
async function loadOverview(preserve=false,more=false){
  if(state.stage!=='overview'||state.view!=='plan'){overviewController?.abort();overviewSerial++;overviewDirty=true;state.overview=new Map();state.overviewPage=0;state.overviewState='idle';return;}
  overviewDirty=false;
  overviewController?.abort();const serial=++overviewSerial,controller=new AbortController();overviewController=controller;
  if(!preserve){state.overview=new Map();state.overviewPage=0;}state.overviewState='loading';state.overviewError='';renderOverview();
  const input={origin:state.origin,year:String(state.year),maxLeave:String(state.maxLeave),minNights:String(state.minNights),buffer:String(state.buffer),month:String(state.month),sort:state.windowSort==='price'?'earliest':state.windowSort};
  const fetchPage=async page=>{
    const data=await fetchJson(`/api/overview?${new URLSearchParams({...input,page:String(page)})}`,controller.signal);
    if(!Array.isArray(data?.windows))throw new Error(data?.error?.message||'요금을 확인하지 못했어요.');
    if(serial!==overviewSerial)return null;
    data.windows.forEach(win=>state.overview.set(win.id,win));state.overviewPage=Math.max(state.overviewPage,page);renderOverview();renderCalendar();return data;
  };
  try{const start=more?state.overviewPage+1:1,last=Math.max(1,Math.ceil(state.windowVisible/4));for(let page=start;page<=last;page++){const data=await fetchPage(page);if(!data||serial!==overviewSerial)return;if(!data.hasNext)break;}state.overviewState='ready';renderOverview();}
  catch(error){if(error.name==='AbortError'||serial!==overviewSerial)return;state.overviewState='error';state.overviewError=error.message;renderOverview();}
}
function renderSelected(){
  const win=state.selected;if(!win){$('#selected-window').innerHTML='';return;}
  $('#selected-window').innerHTML=`<div><p class="selected-label">${icon('plane-takeoff')}${ORIGINS[state.origin]}</p><h2>${icon('calendar-days')}${win.start.slice(0,4)===win.end.slice(0,4)?compactPeriod(win.start,win.end):periodLabel(win.start,win.end)}</h2>${tripChips(win)}</div><button class="text-button schedule-details" data-open-schedule aria-label="선택한 연휴와 연차 일정 확인">${icon('calendar-check-2')}<span>연차</span></button>`;
}
function offerOption(f,label,base){
  const diff=base?f.price-base.price:0;
  return `<button class="offer-option ${base?'long-option':'cheap-option'}" data-detail="${f.id}" aria-label="${escape(f.city)} ${label}, ${f.nights}박 ${money(f.price)}원 상세 보기">${base?`<span class="offer-kind">${label}<span>${f.nights-base.nights}일 더</span></span>`:''}<span class="offer-itinerary"><strong>${icon('calendar-days')}${compactPeriod(f.start,f.end)}</strong><span>날짜상 ${f.nights}박 · 연차 ${f.leave.length}일</span></span><span class="offer-price"><strong>${money(f.price)}<small>원</small></strong>${base?`<span>${diff>0?'+':''}${money(diff)}원 차이</span>`:''}</span>${icon('chevron-right')}</button>`;
}
function allOffers(){return [...state.flights,...Object.values(state.alternatives).flat()];}
function renderFlights(){
  updateFilterCount();updateSearchButton();
  $('#flight-time-notice').hidden=true;
  const root=$('#flight-grid');root.setAttribute('aria-busy',String(['loading','refreshing'].includes(state.searchState)));
  $('#active-preferences').innerHTML=`${state.exact&&!state.buffer?'<span>선택한 날짜</span>':`<span>${state.minNights}박 이상</span>${state.buffer?'<span>복귀 여유 하루</span>':'<span>복귀 여유 없음</span>'}${state.exact?'<span>날짜 고정</span>':''}`}${state.budget?`<span>왕복 ${money(state.budget)}원 이하</span>`:''}`;
  if(state.searchState==='loading'){$('#fare-status').textContent='목적지·왕복 요금 확인 중';root.innerHTML=flightLoading();return;}
  if(state.searchState==='error'){$('#fare-status').textContent='조회 실패';root.innerHTML=`<div class="empty">${icon('circle-alert')}<h2>요금을 확인하지 못했어요</h2><p>${escape(state.searchError)}</p><button class="button primary" data-retry-flights>같은 조건으로 다시 조회</button></div>`;return;}
  const flights=filterFlights(state.flights,{budget:state.budget,region:state.region,sort:state.flightSort,alternatives:state.alternatives});
  $('#flight-time-notice').hidden=true;
  $('#fare-status').textContent=state.fareMeta?`1인 왕복 참고가${state.fareMeta.stale?' · 이전 가격':''}${state.searchState==='refreshing'?' · 갱신 중':''}`:'일정을 선택하세요';
  if(!flights.length){root.innerHTML=`<div class="empty">${travelKit()}<h2>${state.flights.length?'예산·지역에 맞는 항공권이 없어요':'이 조건의 항공권이 없어요'}</h2><p>${state.flights.length?'필터를 바꾸면 다른 여행지를 볼 수 있어요.':state.exact?'선택한 날짜의 요금이 없어요. 다른 날짜로 찾아보세요.':`${state.minNights}박 이상${state.buffer?'과 복귀 여유 하루':''}를 만족하는 요금을 찾지 못했습니다.`}</p>${state.flights.length?'<button class="button primary" data-reset-flights>예산·지역 초기화</button>':state.exact?'<button class="button primary" data-open-custom>날짜 바꾸기</button><button class="text-button" data-flexible-dates>선택한 기간 안에서 다시 찾기</button>':`<button class="button primary" data-relax-nights>1박·복귀 여유 없이 다시 찾기</button><button class="text-button" data-open-settings>조건 직접 바꾸기</button>`}</div>`;return;}
  root.innerHTML=(state.searchState==='refresh-error'?`<div class="inline-warning">${icon('circle-alert')}갱신에 실패해 이전 가격을 표시합니다.<button data-retry-flights>다시 확인</button></div>`:'')+(state.fareMeta?.alternativesStatus==='partial'?`<div class="inline-warning">${icon('circle-alert')}긴 일정 조회에 일부 실패했어요.<button data-retry-flights>다시 확인</button></div>`:'')+flights.slice(0,state.visibleCount).map(f=>{
    const long=(state.alternatives[f.code]||[]).find(option=>option.nights>f.nights&&option.id!==f.id),allowed=long&&(!state.budget||long.price<=state.budget);
    return `<article class="flight-card">${destinationCover(f)}<div class="flight-card-body"><div class="destination-heading"><div><h2><button class="destination-name" data-detail="${f.id}" aria-label="${escape(f.city)} 항공권 상세 보기">${escape(f.city)}</button></h2><span class="destination-country">${country(f)}<span>· ${f.code}</span></span></div><button class="icon-button card-save ${isSaved(flightItem(f))?'saved':''}" data-save-offer="${f.id}" aria-label="${escape(f.city)} ${isSaved(flightItem(f))?'저장 취소':'여행 저장'}" aria-pressed="${isSaved(flightItem(f))}">${icon('bookmark')}</button></div><div class="offer-comparison">${offerOption(f,'왕복')}${allowed?offerOption(long,'여행일 늘리기',f):''}</div>${fareVerdict(f)}${long&&!allowed?`<p class="option-note">${long.nights}박 대안은 ${money(long.price)}원으로 예산을 넘어요.</p>`:''}</div></article>`;
  }).join('')+(flights.length>state.visibleCount?`<button class="button secondary full" data-more-flights>여행지 더 보기 (${state.visibleCount}/${flights.length})${icon('chevron-down')}</button>`:'');
}
async function loadFlights(refresh=false){
  flightController?.abort();const serial=++flightSerial;
  if(state.view!=='plan'){state.searchState='idle';return;}
  if(!state.selected){state.flights=[];state.alternatives={};state.fareMeta=null;state.searchState='idle';renderFlights();return;}
  const input={origin:state.origin,start:state.selected.start,end:state.selected.end,minNights:String(state.minNights),buffer:String(state.buffer),exact:state.exact?'1':'0',alternatives:'1'},query=new URLSearchParams(input).toString();
  const cached=queryCache.get(query),preserve=state.resolvedQuery===query&&state.flights.length>0;
  if(!preserve){state.flights=[];state.alternatives={};state.fareMeta=null;state.visibleCount=12;}
  state.searchState=preserve?'refreshing':'loading';state.searchError='';renderFlights();
  if(!refresh&&cached&&Date.now()-cached.at<120000){state.flights=cached.data.flights;state.alternatives=cached.data.alternatives||{};state.fareMeta=cached.data;state.resolvedQuery=query;state.searchState='ready';renderFlights();restoreDetail();return;}
  const controller=new AbortController();flightController=controller;
  try{
    const data=await fetchJson(`/api/flights?${query}`,controller.signal);
    if(!Array.isArray(data?.flights))throw new Error('운임 결과 형식이 올바르지 않습니다.');if(serial!==flightSerial)return;
    state.flights=data.flights;state.alternatives=data.alternatives||{};state.fareMeta=data;state.resolvedQuery=query;state.searchState='ready';if(queryCache.size>=20)queryCache.delete(queryCache.keys().next().value);queryCache.set(query,{at:Date.now(),data});renderFlights();restoreDetail();
  }catch(error){if(error.name==='AbortError'||serial!==flightSerial)return;state.searchState=preserve?'refresh-error':'error';state.searchError=error.message;renderFlights();}
}
function openDialog(dialog,opener=document.activeElement){if(dialog.open)return;dialogOpeners.set(dialog,opener);dialog.showModal();}
function openSettings(opener=document.activeElement){
  for(const[id,value]of Object.entries({budget:state.budget,region:state.region,'min-nights':state.minNights,'leave-limit':state.maxLeave}))$(`#${id}`).value=String(value);
  $('#return-buffer').checked=Boolean(state.buffer);$('#exact-dates').checked=state.exact;openDialog($('#settings-dialog'),opener);
  $('#region').closest('.field-row').hidden=state.stage!=='results';
  $('#exact-dates').closest('label').hidden=state.stage!=='results';
}
function openSort(opener=document.activeElement){$('#window-sort-options').innerHTML=Object.entries(SORTS).map(([value,label])=>`<button data-window-sort="${value}" aria-pressed="${state.windowSort===value}">${label}${state.windowSort===value?icon('check'):''}</button>`).join('');openDialog($('#sort-dialog'),opener);}
function openCustom(opener=document.activeElement,start){
  for(const id of ['#custom-start','#custom-end']){$(id).min=today;$(id).max='2027-12-31';}
  const draft=quickDraft||state,month=`${draft.year}-${String(draft.month||(draft.year===currentYear?Number(today.slice(5,7)):1)).padStart(2,'0')}`;
  const contextual=state.selected&&state.stage==='results'?state.selected:draft.year===state.year&&draft.month===state.month?visibleWindows()[0]:null;
  const defaultStart=contextual?.start||(`${month}-01`>today?`${month}-01`:today);
  $('#custom-start').value=start||defaultStart;
  $('#custom-end').value=start?'':(contextual?.end||[addDays(defaultStart,3),'2027-12-31'].sort()[0]);
  $('#custom-origin').innerHTML=`${icon('plane-takeoff')}${ORIGINS[draft.origin]} 출발`;
  customMonth=$('#custom-start').value.slice(0,7);customPickingEnd=Boolean(start);$('#custom-date-hint').textContent=start?'귀국편 출발일을 선택하세요.':'출발일과 귀국편 출발일을 선택하세요.';updateCustomPreview();if(start)$('#custom-error').textContent='';renderCustomCalendar();openDialog($('#custom-dialog'),opener);if(start)$(`[data-custom-day="${start}"]`)?.focus({preventScroll:true});
}
function customValidation(){const start=$('#custom-start').value,end=$('#custom-end').value;if(!validDate(start)||!validDate(end))return{error:'출발일과 귀국편 출발일을 선택하세요.'};if(start<today)return{error:'오늘 이후의 출발일을 선택하세요.'};if(end<=start)return{error:'귀국편은 출발일 다음 날부터 선택하세요.'};if(daysBetween(start,end)>16)return{error:'최대 16일 안에서 선택하세요.'};return{window:makeWindow(start,end)};}
function updateCustomPreview(){const result=customValidation();$('#custom-error').textContent=result.error||'';$('#custom-preview').innerHTML=result.window?tripChips(result.window):'';return result;}

function timeline(win){return `<div class="timeline" role="list" aria-label="날짜와 연차 사용일">${rangeDays(win.start,win.end).map(day=>`<div role="listitem" class="day ${day.off?'off':'leave'}" aria-label="${shortDate(day.date)} ${day.weekday}요일 ${escape(day.holiday||(day.off?'주말':'연차 사용'))}"><span>${day.weekday}</span><strong>${Number(day.date.slice(8))}</strong><span>${day.off?(day.holiday?'공휴일':'주말'):'연차'}</span></div>`).join('')}</div>`;}
function openSchedule(opener=document.activeElement){
  const win=state.selected;if(!win)return;
  $('#schedule-dialog').innerHTML=`<div class="sheet-heading"><h2 id="schedule-title">연차 일정</h2><button class="icon-button dialog-close" aria-label="연차 일정 닫기">${icon('x')}</button></div><div class="sheet-content"><p class="schedule-period">${periodLabel(win.start,win.end)}</p><div class="schedule-numbers"><span>휴가 <strong>${win.days}일</strong></span><span>연차 <strong>${win.leave.length}일</strong></span></div>${timeline(win)}<p class="leave-dates">연차 신청일 <strong>${win.leave.map(shortDate).join(' · ')||'없음'}</strong></p><p class="field-help">${state.exact&&!state.buffer?'귀국편 출발일 기준입니다. 한국 도착 시각은 항공편 선택에서 확인하세요.':'휴가 가능 기간입니다. 실제 항공권의 체류일은 다를 수 있어요.'}</p><div class="schedule-actions"><button class="button secondary" data-save-schedule>${icon('bookmark')}${isSaved(scheduleItem())?'일정 저장 취소':'일정 저장'}</button><button class="button primary" data-calendar>${icon('calendar-plus')}캘린더에 추가</button></div></div>`;openDialog($('#schedule-dialog'),opener);
}
function updateDetailSave(){if(!detailFlight||!$('[data-detail-save]'))return;const saved=isSaved(flightItem(detailFlight)),button=$('[data-detail-save]');button.classList.toggle('saved',saved);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',saved?'이 여행 저장 취소':'이 여행 저장');}
function openDetail(value,push=true,opener=document.activeElement){
  const f=typeof value==='object'?value:allOffers().find(offer=>offer.id===value);if(!f)return;
  const active=opener;detailReturnSelector=active?.dataset.detail?`.${CSS.escape(active.classList[0])}[data-detail="${CSS.escape(active.dataset.detail)}"]`:null;detailFlight=f;if(push)syncUrl(true);
  disposeItinerary?.();disposeItinerary=null;
  const root=$('#detail-dialog');
  const collected=f.sellers?.length?`<details class="collected-fares"><summary>날짜별 참고 가격${icon('chevron-down')}</summary><div class="collected-fare-body"><div class="detail-price"><span>성인 1인 · 왕복</span><strong>${money(f.price)}<small>원</small></strong></div><div class="journey-line"><div><span>출발일</span><strong>${shortDate(f.start)}</strong></div><div class="journey-duration">${icon('plane')}<span>날짜상 ${f.nights}박</span></div><div><span>귀국편 출발일</span><strong>${shortDate(f.end)}</strong></div></div><p class="field-help">아래 참고 가격은 날짜별 가격이며 위에서 선택한 항공편의 가격과 다를 수 있어요.</p><div class="detail-leave"><span>필요 연차 <strong>${f.leave.length}일</strong>${state.buffer?' · 복귀 여유 포함':''}</span><button class="icon-button" data-detail-save aria-label="이 여행 저장" aria-pressed="false">${icon('bookmark')}</button></div>${priceEvidence(f)}<div class="seller-heading"><h3>판매처에서 확인</h3></div><div class="seller-list">${f.sellers.map((seller,i)=>`<a href="${bookUrl(f,seller.partner)}" target="_blank" rel="noopener noreferrer" class="seller-row ${i===0?'primary-seller':''}" aria-label="${escape(seller.name)} ${money(seller.price)}원 가격, 같은 날짜 항공권 검색"><span>${escape(seller.name)}</span><strong>${money(seller.price)}원</strong>${icon('external-link')}</a>`).join('')}</div><button class="detail-truth" data-fare-info>${icon('info')}<span>예약 시 가격·좌석이 달라질 수 있어요<small>${sourceTime(f.observedAt)}${f.observedAt?' 기준':''}${state.fareMeta?.stale?' · 이전 가격':''}</small></span>${icon('chevron-right')}</button></div></details>`:'';
  root.innerHTML=`<div class="sheet-heading detail-heading"><div><span class="detail-country">${country(f)} · ${ORIGINS[f.origin]} 출발</span><h2 id="detail-title">${escape(f.city)}</h2></div><button class="icon-button dialog-close" aria-label="항공권 상세 닫기">${icon('x')}</button></div><div class="sheet-content detail-content"><section id="live-flight-panel" class="live-flight-panel" aria-label="실제 항공편 비교"></section>${collected}<div class="detail-tools"><button class="button secondary" data-detail-calendar>${icon('calendar-plus')}캘린더</button><button class="button secondary" data-copy-link>${icon('share-2')}링크 복사</button></div><a class="alternative-search" href="${searchUrl(f,f,f.origin)}" target="_blank" rel="noopener noreferrer">스카이스캐너에서도 같은 날짜 검색${icon('external-link')}</a></div>`;
  if(active?.classList.contains('fare-verdict')&&$('.collected-fares',root)){$('.collected-fares',root).open=true;$('.price-evidence',root).open=true;}
  updateDetailSave();openDialog(root,active);
  disposeItinerary=mountItinerarySearch($('#live-flight-panel'),{flight:f,availableEnd:state.selected?.end||f.end,budget:state.budget,icon,escape,money});
}
function openManualFlight(meta,push=true,opener=$('[data-direct-flights]'),dates=null){
  if(!state.selected)return;
  const start=dates?.start||state.selected.start,end=dates?.end||addDays(state.selected.end,-state.buffer),win=makeWindow(start,end);
  const f={id:`manual-${state.origin}-${meta.code}-${start}-${end}`,origin:state.origin,code:meta.code,city:meta.name.replace(/\([A-Z]{3}\)/,''),country:meta.country,countryCode:meta.countryCode,start,end,nights:daysBetween(start,end)-1,leave:win.leave,sellers:[],manual:true};
  openDetail(f,push,opener);
}
function openDestination(opener){
  if(!state.selected)return;
  const dialog=$('#destination-dialog');disposeDestination?.();
  disposeDestination=destinationPicker(dialog,{origin:state.origin,escape,icon,flagPath,onSelect:meta=>{dialog.close();openManualFlight(meta,true,opener);}});
  openDialog(dialog,opener);
}
function restoreDetail(){
  const params=new URLSearchParams(location.search),value=params.get('offer');if(!value)return;
  const f=allOffers().find(offer=>`${offer.code}~${offer.start}~${offer.end}`===value);
  if(f){openDetail(f,false,$(`[data-detail="${CSS.escape(f.id)}"]`)||$('#destinations-heading'));return;}
  if(params.get('manual')==='1'){
    const [code,start,end]=value.split('~'),nav=navigationSerial,origin=state.origin;
    if(/^[A-Z]{3}$/.test(code||'')&&validRange(start,end)){
      airportCatalog(origin).then(list=>{if(nav!==navigationSerial||origin!==state.origin||new URLSearchParams(location.search).get('offer')!==value)return;const meta=list.find(x=>x.code===code);if(meta)openManualFlight(meta,false,$('[data-direct-flights]'),{start,end});else{toast('여행지를 다시 선택해 주세요.');syncUrl();}}).catch(()=>{if(nav===navigationSerial)toast('여행지를 불러오지 못했어요. 직접 선택해 주세요.');});return;
    }
  }
  toast('이 일정의 현재 운임을 찾지 못했어요. 다른 항공권을 확인하세요.');syncUrl();
}
function animateStage(root){root.classList.remove('stage-enter');if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;void root.offsetWidth;root.classList.add('stage-enter');root.addEventListener('animationend',()=>root.classList.remove('stage-enter'),{once:true});}
let navigationSerial=0,currentTransition;
function transitionView(update){
  const serial=++navigationSerial;
  const run=()=>serial===navigationSerial?update():undefined;
  currentTransition?.skipTransition();
  if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){const pending=run();animateStage(state.view==='saved'?$('#saved-view'):state.stage==='results'?$('#trip-results'):$('#planner'));return Promise.resolve(pending);}
  let pending;
  currentTransition=document.startViewTransition(()=>{pending=run();});
  currentTransition.ready.catch(()=>{});
  return currentTransition.updateCallbackDone.then(()=>pending);
}
function selectWindow(win,{push=true,flexible=false}={}){
  if(!win)return;quickDraft={origin:state.origin,year:state.year,month:state.month};return transitionView(()=>{
    if(state.stage==='overview')overviewScroll=scrollY;
    if(flexible)state.exact=false;
    state.selected=win;calendarMonth=win.start.slice(0,7);state.stage='results';state.view='plan';if(state.overviewState==='loading'){overviewController?.abort();overviewSerial++;overviewDirty=true;state.overviewState='idle';}renderShell();syncUrl(push);
    const pending=loadFlights();window.scrollTo({top:0,behavior:'instant'});$('#destinations-heading').focus({preventScroll:true});return pending;
  });
}
function backOverview(push=true){return transitionView(()=>{quickDraft=null;state.stage='overview';state.view='plan';renderShell();syncUrl(push);if(overviewDirty)loadOverview();window.scrollTo({top:overviewScroll,behavior:'instant'});if(state.selected)$(`[data-window="${CSS.escape(state.selected.id)}"]`)?.focus({preventScroll:true});});}
function switchView(view,push=true){return transitionView(()=>{state.view=view;renderShell();syncUrl(push);if(push)window.scrollTo({top:0,behavior:'instant'});});}
function savedCard(item,index){const win=makeWindow(item.start,item.end);return `<article class="saved-card">${item.code?thumbnail(item):`<span class="destination-symbol">${icon('calendar')}</span>`}<div><h2>${escape(item.city||win.title)}</h2><p>${periodLabel(item.start,item.end)}</p>${item.price?`<span>저장 당시 ${money(item.price)}원</span>`:''}</div><div class="saved-card-actions"><button class="button secondary" data-saved-open="${index}" ${item.start<today?'disabled':''}>${item.code?'현재 요금':'일정 보기'}</button><button class="icon-button" data-saved-remove="${index}" aria-label="${escape(item.city||'일정')} 저장 삭제">${icon('trash-2')}</button></div></article>`;}
function renderSaved(){const upcoming=state.saved.map((item,index)=>({item,index})).filter(({item})=>item.start>=today),past=state.saved.map((item,index)=>({item,index})).filter(({item})=>item.start<today);$('#saved-list').innerHTML=(upcoming.length?upcoming.map(({item,index})=>savedCard(item,index)).join(''):`<div class="empty">${travelKit()}<h2>다음 여행을 담아 보세요</h2><button class="button primary" data-back-plan>연휴 찾아보기</button></div>`)+(past.length?`<details class="past-saved"><summary>지난 일정 ${past.length}개</summary>${past.map(({item,index})=>savedCard(item,index)).join('')}</details>`:'');}
async function openSaved(index){
  const item=state.saved[index];if(!item||item.start<today)return;overviewDirty=true;
  state.origin=item.origin;state.year=Number(item.start.slice(0,4));state.month=0;state.buffer=item.buffer;state.exact=Boolean(item.code)||item.exact===true;state.minNights=Math.max(1,Math.min(2,daysBetween(item.start,item.end)-1));state.budget=0;state.region='all';rebuildWindows();
  const selected=makeWindow(item.start,item.code?addDays(item.end,item.buffer):item.end),pending=selectWindow(selected),serial=navigationSerial,origin=state.origin;
  const expected=new URLSearchParams({origin,start:selected.start,end:selected.end,minNights:String(state.minNights),buffer:String(state.buffer),exact:state.exact?'1':'0',alternatives:'1'}).toString();
  await pending;
  if(serial!==navigationSerial||state.selected?.id!==selected.id||state.origin!==origin||state.stage!=='results'||state.view!=='plan'||state.resolvedQuery!==expected)return;
  const f=state.flights.find(offer=>offer.code===item.code&&offer.start===item.start&&offer.end===item.end);
  if(f)openDetail(f,true,$(`[data-detail="${CSS.escape(f.id)}"]`));else if(item.code)toast('저장한 일정의 현재 요금이 없어요. 다른 항공권을 확인하세요.');
}
$('#settings-form').addEventListener('submit',event=>{
  event.preventDefault();const oldQuery=`${state.minNights}|${state.buffer}|${state.maxLeave}`;
  state.maxLeave=Number($('#leave-limit').value);state.budget=$('#budget').value*1;state.region=$('#region').value;state.minNights=Number($('#min-nights').value);state.buffer=$('#return-buffer').checked?1:0;state.exact=state.stage==='results'&&$('#exact-dates').checked;
  if(state.maxLeave===0&&state.stage==='overview'){state.minNights=1;state.buffer=0;}
  rebuildWindows();dialogOpeners.delete($('#settings-dialog'));$('#settings-dialog').close();renderShell();syncUrl(true);if(oldQuery!==`${state.minNights}|${state.buffer}|${state.maxLeave}`)loadOverview();if(state.stage==='results')loadFlights();
  $('#settings-open').focus({preventScroll:true});
});
for(const id of ['#custom-start','#custom-end'])$(id).addEventListener('input',()=>{updateCustomPreview();if(validDate($(id).value)){customMonth=$(id).value.slice(0,7);renderCustomCalendar();}});
$('#quick-origin').addEventListener('change',event=>{quickDraft.origin=event.target.value;updateSearchButton();$('#search-draft-status').textContent='검색을 누르면 선택한 조건이 적용됩니다.';});
$('#quick-period').addEventListener('change',event=>{if(event.target.value==='custom'){event.target.value=`${quickDraft.year}-${quickDraft.month}`;openCustom(event.target);return;}const [year,month]=event.target.value.split('-').map(Number);Object.assign(quickDraft,{year,month});updateSearchButton();$('#search-draft-status').textContent='검색을 누르면 선택한 조건이 적용됩니다.';});
$('#quick-search').addEventListener('submit',event=>{event.preventDefault();if($('#search-submit').disabled)return;const values={...quickDraft};$('#search-draft-status').textContent='';applyQuick(values);});
$('#custom-form').addEventListener('submit',event=>{
  event.preventDefault();const result=updateCustomPreview();if(result.error)return;
  const origin=quickDraft?.origin||state.origin;
  dialogOpeners.delete($('#custom-dialog'));$('#custom-dialog').close();
  Object.assign(state,{origin,year:Number(result.window.start.slice(0,4)),month:0,exact:true,buffer:0,minNights:1,windowVisible:4});
  $('#search-draft-status').textContent='';rebuildWindows();selectWindow(result.window);loadOverview();
});
$('#flight-sort').addEventListener('change',event=>{state.flightSort=event.target.value;renderFlights();syncUrl();});
document.addEventListener('click',async event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.hasAttribute('data-calendar-prev')||target.hasAttribute('data-calendar-next')){calendarMonth=monthShift(calendarMonth,target.hasAttribute('data-calendar-prev')?-1:1);renderCalendar();}
  else if(target.dataset.calendarDay)openCustom(target,target.dataset.calendarDay);
  else if(target.hasAttribute('data-custom-prev')||target.hasAttribute('data-custom-next')){customMonth=monthShift(customMonth,target.hasAttribute('data-custom-prev')?-1:1);renderCustomCalendar();}
  else if(target.dataset.holidayMonth){const name=target.textContent;customMonth=target.dataset.holidayMonth;renderCustomCalendar();$$('[data-holiday-month]').find(b=>b.textContent===name)?.focus({preventScroll:true});}
  else if(target.dataset.holidayRange){const [start,end]=target.dataset.holidayRange.split('_');$('#custom-start').value=start;$('#custom-end').value=end;customPickingEnd=false;updateCustomPreview();renderCustomCalendar();$(`[data-holiday-range="${start}_${end}"]`)?.focus({preventScroll:true});$('#custom-date-hint').textContent='선택한 연휴로 여행지를 찾아보세요.';}
  else if(target.dataset.customDay){const day=target.dataset.customDay;if(!customPickingEnd||day<$('#custom-start').value){$('#custom-start').value=day;$('#custom-end').value='';customPickingEnd=true;$('#custom-date-hint').textContent='귀국편 출발일을 선택하세요.';}else{$('#custom-end').value=day;customPickingEnd=false;$('#custom-date-hint').textContent='선택한 날짜로 검색하세요.';}updateCustomPreview();if(customPickingEnd)$('#custom-error').textContent='';renderCustomCalendar();$(`[data-custom-day="${day}"]`)?.focus({preventScroll:true});}
  else if(target.dataset.recommendWindow){selectWindow(state.allWindows.find(win=>win.id===target.dataset.recommendWindow),{flexible:true});}
  else if(target.dataset.window){selectWindow(state.allWindows.find(win=>win.id===target.dataset.window),{flexible:true});}
  else if(target.dataset.year){state.year=Number(target.dataset.year);state.month=0;state.windowVisible=4;state.selected=null;rebuildWindows();renderShell();syncUrl(true);loadOverview();$(`[data-year="${state.year}"]`)?.focus({preventScroll:true});}
  else if(target.hasAttribute('data-more-windows')){const previous=state.windowVisible;state.windowVisible+=4;renderOverview();loadOverview(true,true);const next=visibleWindows()[previous];if(next)$(`[data-window="${CSS.escape(next.id)}"]`)?.focus({preventScroll:true});}
  else if(target.hasAttribute('data-more-flights')){const previous=state.visibleCount;state.visibleCount+=12;renderFlights();$$('.destination-name')[previous]?.focus({preventScroll:true});}
  else if(target.dataset.detail)openDetail(target.dataset.detail,true,target);
  else if(target.dataset.saveOffer){const f=allOffers().find(offer=>offer.id===target.dataset.saveOffer);if(f)toggleSaved(flightItem(f));}
  else if(target.hasAttribute('data-detail-save'))toggleSaved(flightItem(detailFlight));
  else if(target.hasAttribute('data-save-schedule')){toggleSaved(scheduleItem());const dialog=$('#schedule-dialog');dialog.querySelector('[data-save-schedule]').innerHTML=`${icon('bookmark')}${isSaved(scheduleItem())?'일정 저장 취소':'일정 저장'}`;}
  else if(target.hasAttribute('data-calendar'))downloadCalendar(state.selected);
  else if(target.hasAttribute('data-detail-calendar'))downloadCalendar(makeWindow(detailFlight.start,detailFlight.recoveryEnd),detailFlight.city);
  else if(target.hasAttribute('data-copy-link')){try{await navigator.clipboard.writeText(location.href);toast('여행 링크를 복사했어요.');}catch{toast('주소창의 링크를 복사해 주세요.');}}
  else if(target.dataset.region){state.region=target.dataset.region;state.visibleCount=12;renderFlights();$$('#region-tabs button').forEach(button=>button.setAttribute('aria-pressed',String(button===target)));syncUrl();}
  else if(target.dataset.windowSort){state.windowSort=target.dataset.windowSort;state.windowVisible=4;state.overviewPage=0;$('#sort-dialog').close();renderOverview();syncUrl();if(state.windowSort!=='price')loadOverview(true);}
  else if(target.id==='settings-reset'){for(const[id,value]of Object.entries({budget:'0',region:'all','min-nights':'2','leave-limit':'2'}))$(`#${id}`).value=value;$('#return-buffer').checked=true;$('#exact-dates').checked=false;}
  else if(target.hasAttribute('data-open-settings')||['settings-open','mobile-settings-open','results-settings-open'].includes(target.id))openSettings(target);
  else if(target.hasAttribute('data-open-custom')||['custom-open','nav-calendar'].includes(target.id))openCustom(target);
  else if(target.id==='overview-sort-open')openSort(target);
  else if(target.id==='overview-retry')loadOverview(true);
  else if(target.hasAttribute('data-retry-flights')||target.id==='refresh-flights')loadFlights(true);
  else if(target.hasAttribute('data-flexible-dates')){state.exact=false;state.minNights=1;renderShell();syncUrl(true);loadFlights();}
  else if(target.hasAttribute('data-relax-nights')){state.minNights=1;state.buffer=0;rebuildWindows();renderShell();syncUrl(true);if(state.stage==='results')loadFlights();loadOverview();toast('1박 이상·복귀 여유 없음으로 변경했어요. 한국 도착 시각은 항공편 선택에서 확인하세요.');}
  else if(target.hasAttribute('data-reset-budget')){state.budget=0;renderShell();syncUrl();}
  else if(target.hasAttribute('data-reset-flights')){state.budget=0;state.region='all';renderShell();syncUrl();}
  else if(target.hasAttribute('data-direct-flights'))openDestination(target);
  else if(target.hasAttribute('data-open-schedule'))openSchedule(target);
  else if(target.hasAttribute('data-fare-info'))openDialog($('#fare-info-dialog'),target);
  else if(target.classList.contains('dialog-close'))target.closest('dialog').close();
  else if(target.id==='back-overview')backOverview();
  else if(target.id==='nav-saved')switchView('saved');
  else if(['nav-plan','nav-home'].includes(target.id)||target.hasAttribute('data-back-plan'))backOverview();
  else if(target.hasAttribute('data-saved-open'))openSaved(Number(target.dataset.savedOpen));
  else if(target.hasAttribute('data-saved-remove')){const index=Number(target.dataset.savedRemove),[removed]=state.saved.splice(index,1);persistSaved();renderSaved();renderFlights();toast('저장을 삭제했어요.',()=>restoreSaved(removed,index));}
});
document.addEventListener('keydown',event=>{
  const cell=event.target.closest('[data-calendar-day],[data-custom-day]');if(!cell)return;
  const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(event.key in moves))return;
  event.preventDefault();const custom=cell.hasAttribute('data-custom-day'),date=addDays(custom?cell.dataset.customDay:cell.dataset.calendarDay,moves[event.key]);
  if(date<today||date>'2027-12-31')return;
  if(custom){customMonth=date.slice(0,7);renderCustomCalendar();}else{calendarMonth=date.slice(0,7);renderCalendar();}
  const root=custom?$('#custom-calendar'):$('#month-calendar'),next=root.querySelector(`[data-${custom?'custom-day':'calendar-day'}="${date}"]`);
  root.querySelectorAll('[role="gridcell"]').forEach(el=>el.tabIndex=-1);if(next){next.tabIndex=0;next.focus({preventScroll:true});}
});
$('#window-list').addEventListener('pointerover',event=>{const button=event.target.closest('[data-window]');if(!button||button.contains(event.relatedTarget))return;const win=state.allWindows.find(w=>w.id===button.dataset.window);if(win){calendarMonth=win.start.slice(0,7);renderCalendar(win);}});
$('#window-list').addEventListener('focusin',event=>{const win=state.allWindows.find(w=>w.id===event.target.closest('[data-window]')?.dataset.window);if(win){calendarMonth=win.start.slice(0,7);renderCalendar(win);}});
$$('dialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{if(dialog.id==='destination-dialog'){disposeDestination?.();disposeDestination=null;}if(dialog.id==='detail-dialog'){disposeItinerary?.();disposeItinerary=null;if(suppressDetailClose){suppressDetailClose--;return;}detailFlight=null;if(!restoring){if(history.state?.detail)history.back();else syncUrl();}}const opener=dialogOpeners.get(dialog);if(opener?.isConnected&&(!document.querySelector('dialog[open]')||opener.closest('dialog[open]')))opener.focus({preventScroll:true});});
});
window.addEventListener('popstate',async()=>{
  navigationSerial++;currentTransition?.skipTransition();quickDraft=null;restoring=true;const priorSelected=state.selected,priorQuery=`${state.origin}|${state.selected?.start}|${state.selected?.end}|${state.minNights}|${state.buffer}|${state.exact}`,oldOverview=`${state.origin}|${state.year}|${state.maxLeave}|${state.month}|${state.minNights}|${state.buffer}|${state.windowSort}`,next=stateFromUrl();
  if(!new URLSearchParams(location.search).has('offer')&&$('#detail-dialog').open){suppressDetailClose++;$('#detail-dialog').close();detailFlight=null;}
  Object.assign(state,next);rebuildWindows();renderShell();animateStage(state.view==='saved'?$('#saved-view'):state.stage==='results'?$('#trip-results'):$('#planner'));
  if(state.stage==='overview'&&!state.selected)state.selected=priorSelected;
  const nextQuery=`${state.origin}|${state.selected?.start}|${state.selected?.end}|${state.minNights}|${state.buffer}|${state.exact}`;
  if(state.stage==='results'&&priorQuery!==nextQuery)await loadFlights();else if(state.stage==='results')restoreDetail();
  if(overviewDirty||oldOverview!==`${state.origin}|${state.year}|${state.maxLeave}|${state.month}|${state.minNights}|${state.buffer}|${state.windowSort}`)loadOverview();
  restoring=false;if(state.stage==='overview'){window.scrollTo({top:overviewScroll,behavior:'instant'});if(state.selected)$(`[data-window="${CSS.escape(state.selected.id)}"]`)?.focus({preventScroll:true});}else if(!new URLSearchParams(location.search).has('offer')&&detailReturnSelector)$(detailReturnSelector)?.focus({preventScroll:true});
});
window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY)return;state.saved=readSaved();savedCount();renderFlights();if(state.view==='saved')renderSaved();updateDetailSave();});
function refreshToday(){
  const nextToday=todayInSeoul();if(nextToday===today)return;
  const priorYear=currentYear;today=nextToday;currentYear=[2026,2027].includes(Number(today.slice(0,4)))?Number(today.slice(0,4)):2027;
  if(state.year===priorYear&&priorYear!==currentYear)state.year=currentYear;
  if(state.selected?.start<today){if($('#detail-dialog').open){suppressDetailClose++;$('#detail-dialog').close();}flightController?.abort();flightSerial++;detailFlight=null;state.selected=null;state.stage='overview';state.flights=[];state.alternatives={};state.fareMeta=null;state.resolvedQuery='';state.searchState='ready';}
  state.windowVisible=4;state.overviewPage=0;rebuildWindows();renderShell();syncUrl();loadOverview();
  if(state.stage==='results'&&state.selected)loadFlights(true);
  if($('#custom-dialog').open){$('#custom-start').min=today;$('#custom-end').min=today;updateCustomPreview();}
}
function scheduleTodayRefresh(){
  clearTimeout(todayTimer);
  const midnight=Date.parse(`${addDays(todayInSeoul(),1)}T00:00:00+09:00`);
  todayTimer=setTimeout(()=>{refreshToday();scheduleTodayRefresh();},Math.max(1000,midnight-Date.now()+25));
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshToday();scheduleTodayRefresh();}});
window.addEventListener('pageshow',()=>{refreshToday();scheduleTodayRefresh();});
hydrateIcons();
document.documentElement.removeAttribute('data-theme');
rebuildWindows();
if(state.stage==='results'&&!state.selected)state.selected=visibleWindows()[0]||null;
calendarMonth=state.selected?.start.slice(0,7)||`${state.year}-${String(state.month||(state.year===currentYear?Number(today.slice(5,7)):1)).padStart(2,'0')}`;
renderShell();$('.search-toolbar').inert=false;$('.search-toolbar').setAttribute('aria-busy','false');syncUrl();loadOverview();if(state.stage==='results')loadFlights();
scheduleTodayRefresh();
