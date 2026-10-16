import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {mockFlights} from './fixtures.js';
import {parsePage,googleUrl} from '../../server/google-wire.js';
const outRows=JSON.parse(await readFile(new URL('../fixtures/google-outbound.json',import.meta.url))),inRows=JSON.parse(await readFile(new URL('../fixtures/google-return.json',import.meta.url)));
const html=rows=>`AF_initDataCallback({key: 'ds:1', data:${JSON.stringify([null,null,[rows],[[]]])}, sideChannel: {}});`;
const outbound=parsePage(html(outRows),{origin:'ICN',destination:'NRT',date:'2026-11-05'}).flights;
const inbound=parsePage(html(inRows),{origin:'NRT',destination:'ICN',date:'2026-11-08',outbound:outbound[0].selection}).flights;
const query={origin:'ICN',code:'NRT',start:'2026-11-05',end:'2026-11-08'};
const item={...query,id:'test-NRT',city:'도쿄',country:'일본',countryCode:'JP',nights:3,leave:['2026-11-05','2026-11-06'],price:150000,sellers:[{partner:'tripcom',name:'트립닷컴',price:150000}],observedAt:'2026-10-16T03:00:00Z'};
const searchUrl='/?origin=ICN&start=2026-11-05&end=2026-11-08&exact=1&buffer=0&minNights=1&offer=NRT~2026-11-05~2026-11-08';

async function setup(page,{fail=false,delay=0,priceChange=0,disappeared=false}={}){
  await page.clock.setFixedTime(new Date('2026-10-16T03:00:00Z'));await mockFlights(page);
  await page.route('**/api/flights?**',route=>route.fulfill({json:{flights:[item],alternatives:{NRT:[item]},stale:false}}));
  const calls=[];
  await page.route('**/api/itineraries?**',async route=>{
    const q=new URL(route.request().url()).searchParams;calls.push(Object.fromEntries(q));
    if(delay)await new Promise(r=>setTimeout(r,delay));
    if(fail){await route.fulfill({status:502,json:{error:{message:'항공편 원본 조회가 잠시 제한됐어요.'}}});return;}
    const returning=q.has('outbound'),refresh=q.get('refresh')==='1';
    const flights=returning?(refresh&&disappeared?[]:inbound.map(f=>({...f,price:f.price+(refresh?priceChange:0),bookingUrl:googleUrl(query,outbound[0].selection,f.selection)}))):outbound;
    await route.fulfill({json:{flights,source:'Google 항공편',priceType:returning?'roundtrip':'roundtrip-from',observedAt:'2026-10-16T03:00:00Z',expiresAt:'2026-10-16T03:01:00Z',searchUrl:googleUrl(query),partial:false}});
  });
  return calls;
}
async function open(page){await page.goto(searchUrl);await expect(page.locator('.live-flight-card').first()).toBeVisible();}
async function chooseReturn(page){await page.locator('[data-live-select]').first().click();await expect(page.locator('.live-title h3')).toHaveText('귀국편 선택');await expect(page.locator('.live-flight-card').first()).toBeVisible();}
async function settleMotion(page){await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getComputedTiming().iterations)).map(a=>a.finished.catch(()=>{}))));}

test('가격과 동일한 양방향 항공편을 고르고 재확인한 뒤 연결한다',async({page})=>{
  const calls=await setup(page);await open(page);await expect(page.locator('.live-flight-card').first()).toContainText('421,700');
  await expect(page.locator('.collected-fares')).not.toHaveAttribute('open');
  await chooseReturn(page);expect(calls[1].outbound).toBe(outbound[0].id);
  await page.locator('[data-live-select]').first().click();await expect(page.locator('.live-stay')).toContainText('71시간 35분');await expect(page.locator('.live-stay')).toContainText('11.8 13:30');
  await expect(page.locator('[data-live-book]')).toHaveCount(0);await page.locator('[data-live-refresh]').click();
  await expect(page.locator('[data-live-book]')).toHaveAttribute('href',/^https:\/\/www\.google\.com\/travel\/flights\/booking\?/);
  expect(calls[2].refresh).toBe('1');await expect(page.locator('.live-review-price')).toContainText('421,700');
  await page.locator('[data-live-back]').click();await expect(page.locator('.live-title h3')).toHaveText('귀국편 선택');
  await page.locator('[data-live-back]').click();await expect(page.locator('.live-title h3')).toHaveText('출국편 선택');expect(calls).toHaveLength(3);
});
test('재확인 때 바뀐 가격을 숨기지 않고 사용자가 변경 내용을 본 뒤 이동한다',async({page})=>{
  await setup(page,{priceChange:9000});await open(page);await chooseReturn(page);await page.locator('[data-live-select]').first().click();await page.locator('[data-live-refresh]').click();
  await expect(page.locator('.live-change')).toContainText('421,700원에서 430,700원');await expect(page.locator('.live-review-price')).toContainText('430,700');await expect(page.locator('[data-live-book]')).toContainText('변경 내용 확인');
  await page.clock.setFixedTime(new Date('2026-10-16T03:02:00Z'));await page.locator('[data-live-book]').click();await expect(page.locator('[data-live-book]')).toHaveCount(0);await expect(page.locator('[data-live-refresh]')).toBeVisible();
});
test('매진·누락된 왕복 여정을 이전 가격으로 연결하지 않는다',async({page})=>{
  await setup(page,{disappeared:true});await open(page);await chooseReturn(page);await page.locator('[data-live-select]').first().click();await page.locator('[data-live-refresh]').click();
  await expect(page.locator('.live-error')).toContainText('현재 요금을 찾지 못했어요');await expect(page.locator('[data-live-book]')).toHaveCount(0);await page.locator('[data-live-back]').click();await expect(page.locator('.live-title h3')).toHaveText('귀국편 선택');
});
test('출도착 시간과 귀국 마감 필터의 빈 결과를 초기화해 복구한다',async({page})=>{
  await setup(page);await open(page);await page.locator('.live-filters>summary').click();await page.locator('[name=departFrom]').fill('20:00');await page.locator('[name=departTo]').fill('19:00');await page.locator('[data-live-filters]').getByRole('button',{name:'적용',exact:true}).click();await expect(page.locator('.live-filter-error')).toContainText('시작 시각');
  await page.locator('[name=departFrom]').fill('00:00');await page.locator('[name=departTo]').fill('23:59');await page.locator('[data-live-filters]').getByRole('button',{name:'적용',exact:true}).click();
  await chooseReturn(page);await page.locator('.live-filters>summary').click();await page.locator('[name=deadline]').fill('2026-11-08T12:00');await page.locator('[data-live-filters]').getByRole('button',{name:'적용',exact:true}).click();
  await expect(page.locator('.live-empty')).toContainText('조건에 맞는 항공편');await page.locator('.live-empty [data-live-reset]').click();await expect(page.locator('.live-flight-card').first()).toBeVisible();
});
test('원본 오류는 항공편 없음으로 표시하지 않고 조건을 보존한다',async({page})=>{
  const calls=await setup(page,{fail:true});await page.goto(searchUrl);await expect(page.locator('.live-error')).toContainText('조회가 잠시 제한');await expect(page.locator('.live-empty')).toHaveCount(0);await expect(page.locator('.live-title')).toContainText('ICN → NRT');
  await page.locator('[data-live-retry]').click();await expect(page.locator('.live-error')).toBeVisible();expect(calls).toHaveLength(2);
});
test('참고 가격이 없는 날짜도 여행지를 직접 골라 실제 항공편을 검색하고 공유한다',async({page})=>{
  await setup(page);
  await page.route('**/api/flights?**',route=>route.fulfill({json:{flights:[],alternatives:{}}}));
  await page.route('**/api/routes?**',route=>route.fulfill({json:{routes:{NRT:{code:'NRT',name:'도쿄(나리타)',country:'일본',countryCode:'JP'}}}}));
  await page.goto(searchUrl.split('&offer=')[0]);await expect(page.locator('#flight-grid .empty')).toBeVisible();
  await page.locator('[data-direct-flights]').click();await page.getByRole('searchbox',{name:'도시·국가·공항 검색'}).fill('도쿄');await expect(page.locator('[data-airport=NRT]')).toBeVisible();await settleMotion(page);const accessibility=await new AxeBuilder({page}).include('#destination-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(accessibility.violations).toEqual([]);await page.locator('[data-airport=NRT]').click();
  await expect(page.locator('.live-flight-card').first()).toBeVisible();await expect(page.locator('.collected-fares')).toHaveCount(0);await expect(page).toHaveURL(/manual=1/);
  await page.reload();await expect(page.locator('.live-flight-card').first()).toBeVisible();await expect(page.locator('#detail-title')).toContainText('도쿄');
});
test('조회 도중 닫은 상세가 늦은 응답으로 다시 열리지 않는다',async({page})=>{
  await setup(page,{delay:600});await page.goto(searchUrl);await expect(page.locator('.live-loading')).toBeVisible();await page.locator('#detail-dialog .dialog-close').click();await expect(page.locator('#detail-dialog')).not.toBeVisible();await page.waitForTimeout(700);await expect(page.locator('#detail-dialog')).not.toBeVisible();await expect(page).not.toHaveURL(/offer=/);
});
test('항공편 목록·필터·최종 여정은 모바일과 확대 너비에서 접근 가능하다',async({page})=>{
  await setup(page);await open(page);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.locator('.live-filters').evaluate(e=>e.open=true);expect(await page.locator('#detail-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);}
  await settleMotion(page);let results=await new AxeBuilder({page}).include('#detail-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
  await page.locator('.live-filters').evaluate(e=>e.open=false);await chooseReturn(page);await page.locator('[data-live-select]').first().click();await page.locator('.live-review-detail').first().evaluate(e=>e.open=true);
  results=await new AxeBuilder({page}).include('#detail-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
});
