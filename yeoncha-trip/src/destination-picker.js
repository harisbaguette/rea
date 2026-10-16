import {authFetch} from './auth-fetch.js';
const catalogs=new Map();
export async function airportCatalog(origin,signal) {
  if(catalogs.has(origin))return catalogs.get(origin);
  const r=await authFetch(`/api/routes?origin=${encodeURIComponent(origin)}`,{signal,headers:{Accept:'application/json'}});
  let data;try{data=await r.json();}catch{throw new Error('여행지를 불러오지 못했어요. 다시 시도해 주세요.');}
  if(!r.ok||!data.routes)throw new Error('여행지를 불러오지 못했어요. 다시 시도해 주세요.');
  const list=Object.values(data.routes).filter(x=>/^[A-Z]{3}$/.test(x.code)&&typeof x.name==='string').sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  catalogs.set(origin,list);return list;
}
export function destinationPicker(dialog,{origin,escape,icon,flagPath,onSelect}) {
  let controller=new AbortController(),destroyed=false,list=[];
  dialog.innerHTML=`<div class="sheet-heading"><h2 id="destination-title">여행지 선택</h2><button class="icon-button dialog-close" aria-label="여행지 선택 닫기">${icon('x')}</button></div><div class="sheet-content"><label class="destination-query">${icon('search')}<input type="search" aria-label="도시·국가·공항 검색" placeholder="도시·국가·공항" autocomplete="off"></label><div class="destination-options" aria-live="polite"><p>여행지 불러오는 중</p></div></div>`;
  const input=dialog.querySelector('input'),options=dialog.querySelector('.destination-options');
  const render=()=>{
    const term=input.value.trim().toLowerCase(),matches=list.filter(x=>`${x.name} ${x.country} ${x.code}`.toLowerCase().includes(term));
    options.innerHTML=matches.slice(0,80).map(x=>`<button data-airport="${x.code}"><span class="destination-picker-flag">${flagPath(x.countryCode)?`<img src="${flagPath(x.countryCode)}" width="28" height="21" alt="">`:icon('globe-2')}</span><span><strong>${escape(x.name.replace(/\([A-Z]{3}\)/,''))}</strong><small>${escape(x.country)}</small></span><b>${x.code}</b>${icon('chevron-right')}</button>`).join('')||'<p>일치하는 여행지가 없어요.</p>';
  };
  async function load(){try{list=await airportCatalog(origin,controller.signal);if(!destroyed)render();}catch(e){if(!destroyed)options.innerHTML=`<p>${escape(e.message)}</p><button class="button secondary" data-airport-retry>다시 불러오기</button>`;}}
  input.addEventListener('input',render);
  const click=event=>{const button=event.target.closest('button');if(button?.hasAttribute('data-airport-retry'))load();else if(button?.dataset.airport){const item=list.find(x=>x.code===button.dataset.airport);if(item)onSelect(item);}};
  dialog.addEventListener('click',click);load();
  return ()=>{destroyed=true;controller.abort();dialog.removeEventListener('click',click);};
}
