import { findWindows, makeWindow, addDays, daysBetween, rangeDays } from '../../src/calendar.js';
const observedAt = '2026-10-15T03:00:00Z';
function fixtureOffers(q, { price = 210000 } = {}) {
  const last = addDays(q.end, q.buffer === '0' ? 0 : -1), maxNights=daysBetween(q.start,last)-1;
  if(maxNights < Number(q.minNights)) return {flights:[],alternatives:{}};
  const start=q.exact==='1' ? q.start : addDays(q.start,Math.min(2,maxNights-Number(q.minNights)));
  const end=q.exact==='1' ? last : addDays(start,Number(q.minNights));
  const base={origin:q.origin,start,end,recoveryEnd:addDays(end,Number(q.buffer)),nights:daysBetween(start,end)-1,leave:makeWindow(start,addDays(end,Number(q.buffer))).leave,average:300000,discount:30,observedAt,bestSeason:false,beach:false,scheduleVerified:false};
  const flight={...base,id:`${q.origin}-KIX-${start}-${end}`,code:'KIX',city:'오사카',country:'일본',countryCode:'JP',continent:'아시아',price:q.origin==='PUS' ? price-20000 : price,partner:'tripcom',sellers:[{partner:'tripcom',name:'트립닷컴',price:q.origin==='PUS'?price-20000:price},{partner:'agoda',name:'아고다',price:price+10000}]};
  const danang={...base,id:`${q.origin}-DAD-${start}-${end}`,code:'DAD',city:'다낭',country:'베트남',countryCode:'VN',continent:'아시아',price:310000,discount:-3.3,partner:'tripcom',beach:true,sellers:[{partner:'tripcom',name:'트립닷컴',price:310000}]};
  const long={...flight,id:`${q.origin}-KIX-${q.start}-${last}`,start:q.start,end:last,recoveryEnd:q.end,nights:maxNights,leave:makeWindow(q.start,q.end).leave,price:flight.price+7900,sellers:[{partner:'tripcom',name:'트립닷컴',price:flight.price+7900}]};
  return {flights:[flight,danang],alternatives:{KIX:long.nights>flight.nights ? [flight,long]:[flight],DAD:[danang]}};
}
export async function mockFlights(page,{failFirst=false,delayFirst=false,overviewFailFirst=false,overviewErrorItem=false,overviewEmptyItem=false,overviewEmptyFirst=false,overviewDelayFirst=false,partialAlternatives=false,overviewPartial=false,today='2026-10-15'}={}) {
  let count=0,overviewCount=0;
  await page.route('**/api/overview?**',async route=>{
    overviewCount++;
    const q=Object.fromEntries(new URL(route.request().url()).searchParams);
    if(overviewFailFirst&&overviewCount===1){await route.fulfill({status:503,json:{error:{message:'연휴 운임 제공처가 응답하지 않습니다.'}}});return;}
    if(overviewDelayFirst&&overviewCount===1) await new Promise(resolve=>setTimeout(resolve,400));
    const all=findWindows({year:Number(q.year),maxLeave:Number(q.maxLeave),today,minDays:Number(q.minNights)+Number(q.buffer)+1}).filter(win=>!Number(q.month)||win.month===Number(q.month));
    all.sort((a,b)=>(q.sort==='longest'?b.days-a.days:q.sort==='leave'?a.leave.length-b.leave.length:q.sort==='efficiency'?b.days/Math.max(1,b.leave.length)-a.days/Math.max(1,a.leave.length):0)||a.start.localeCompare(b.start));
    const windows=all.slice((Number(q.page)-1)*4,Number(q.page)*4).map((win,i)=>{
      const fares=fixtureOffers({...q,start:win.start,end:win.end,exact:'0'},{price:210000+i*10000}),error=overviewErrorItem&&Number(q.page)===1&&i===1,empty=(overviewEmptyItem&&Number(q.page)===1&&i===2)||(overviewEmptyFirst&&Number(q.page)===1&&i===0);
      return {...win,status:error?'error':empty||!fares.flights.length?'empty':'ready',cheapest:error||empty?null:fares.flights[0]||null,longStay:error||empty||overviewPartial?null:fares.alternatives.KIX?.[1]||null,alternativesStatus:overviewPartial?'partial':'ready',...(overviewPartial?{error:{code:'UPSTREAM_LIMIT',message:'긴 일정 조회 실패'}}:{}),destinationsCount:fares.flights.length,updatedAt:observedAt,stale:false,complete:true,...(error?{error:{code:'SOURCE_UNAVAILABLE',message:'판매처 응답 실패'}}:{})};
    });
    await route.fulfill({json:{origin:q.origin,year:Number(q.year),today,sort:q.sort||'earliest',maxLeave:Number(q.maxLeave),minNights:Number(q.minNights),buffer:Number(q.buffer),page:Number(q.page),pageSize:4,totalWindows:all.length,hasNext:Number(q.page)*4<all.length,windows}});
  });
  await page.route('**/api/flights?**',async route=>{
    count++;const q=Object.fromEntries(new URL(route.request().url()).searchParams);
    if(failFirst&&count===1){await route.fulfill({status:503,json:{error:{message:'운임 제공처에 일시적인 문제가 있어요.'}}});return;}
    if(delayFirst&&count===1)await new Promise(resolve=>setTimeout(resolve,400));
    await route.fulfill({json:{...fixtureOffers(q),alternativesStatus:partialAlternatives?'partial':'ready',query:q,complete:true,stale:false,updatedAt:observedAt,fetchedAt:observedAt,source:'시험용 응답'}});
  });
  await page.route('**/api/itineraries?**',route=>route.fulfill({status:503,json:{error:{message:'항공편 시험 응답이 설정되지 않았어요.'}}}));
  await page.route('**/api/history?**',route=>route.fulfill({json:{items:[{date:'2026-10-12',price:250000},{date:'2026-10-13',price:240000},{date:'2026-10-14',price:210000}],min:210000,max:250000,stale:false}}));
}
export async function chooseFirstWindow(page){
  await page.locator('.window-option').first().click();
  await page.locator('.flight-card').first().waitFor();
}
export async function applySettings(page,edit){
  await page.locator('#settings-open').click();
  await edit();
  await page.getByRole('button',{name:'이 조건으로 찾기',exact:true}).click();
}
