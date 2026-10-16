import {test,expect} from '@playwright/test';
import {mockFlights,chooseFirstWindow} from './fixtures.js';

test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));
  await mockFlights(page);await page.goto('/');
  await expect(page.locator('.window-fare').first()).toBeVisible();
  await expect(page.locator('#search-submit')).toBeEnabled();
});

test('시기와 공항은 검색을 눌러 한 번에 적용하고 이전 결과의 출발지를 구별한다',async({page})=>{
  const queries=[];page.on('request',r=>{if(r.url().includes('/api/overview?'))queries.push(new URL(r.url()).searchParams);});
  const before=page.url();
  await page.locator('#quick-period').selectOption('2027-9');
  await page.locator('#quick-origin').selectOption('PUS');
  await expect(page.locator('#search-context')).toContainText('인천');
  await expect(page.locator('.search-toolbar')).toHaveClass(/has-draft/);
  expect(page.url()).toBe(before);expect(queries).toHaveLength(0);
  await page.locator('#search-submit').click();
  await expect(page.locator('.window-fare').first()).toContainText('190,000');
  await expect(page.locator('#search-context')).toContainText('부산·김해');
  await expect(page.locator('#quick-period')).toHaveValue('2027-9');
  expect(queries).toHaveLength(1);expect(queries[0].get('origin')).toBe('PUS');expect(queries[0].get('month')).toBe('9');expect(queries[0].get('year')).toBe('2027');
});

test('검색 버튼은 키보드로 실행하고 요청 중 중복 제출을 막는다',async({page})=>{
  let release;const gate=new Promise(r=>release=r);let calls=0;
  await page.route('**/api/overview?**',async route=>{calls++;await gate;await route.fallback();});
  await page.locator('#quick-period').selectOption('2026-11');
  await page.locator('#search-submit').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#search-submit')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#search-submit')).toBeDisabled();expect(calls).toBe(1);
  await page.locator('#quick-origin').selectOption('PUS');
  await expect(page.locator('#search-submit')).toBeEnabled();
  release();await expect(page.locator('.window-fare').first()).toBeVisible();
  await expect(page.locator('#quick-origin')).toHaveValue('PUS');
  await expect(page.locator('#search-context')).toContainText('인천');
});

test('불필요한 설명 대신 날짜 아이콘과 칩·명확한 이동 행동을 제공',async({page})=>{
  await expect(page.locator('#window-count,.fare-rank')).toHaveCount(0);
  await expect(page.locator('#planner')).not.toContainText(/수집가|쉬어 가요|일만 연결|이후 · 일정/);
  await expect(page.locator('.schedule-pick .trip-chip')).toHaveCount(2);
  await expect(page.locator('.schedule-pick .action-arrow')).toBeVisible();
  await expect(page.locator('.window-schedule>.icon').first()).toBeVisible();
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,1000]]){
    await page.setViewportSize({width,height});
    const fare=await page.locator('.window-fare').first().boundingBox();
    const nav=await page.locator('.app-navigation').boundingBox();
    expect(fare.y+fare.height).toBeLessThan(width<=800?nav.y:height);
    const overlap=await page.locator('.window-option').evaluateAll(cards=>cards.some(card=>card.querySelector('.window-schedule strong').getBoundingClientRect().right>card.querySelector('.window-offer').getBoundingClientRect().left));
    expect(overlap).toBe(false);
  }
});

test('기본 화면 전환은 네트워크를 기다리지 않고 대기 장면을 보여준다',async({page})=>{
  await page.evaluate(()=>{window.__transitions=0;const original=document.startViewTransition?.bind(document);if(original)document.startViewTransition=fn=>{window.__transitions++;return original(fn);};});
  let release;const gate=new Promise(r=>release=r);
  await page.route('**/api/flights?**',async route=>{await gate;await route.fallback();});
  await page.locator('.window-option').first().click();
  await expect(page.locator('.flight-loading')).toBeVisible();
  await page.waitForFunction(()=>[...document.querySelectorAll('.travel-kit')].every(i=>i.complete&&i.naturalWidth>0));
  expect(await page.evaluate(()=>window.__transitions)).toBe(1);
  await expect(page.locator('#destinations-heading')).toBeFocused();
  release();await expect(page.locator('.flight-card').first()).toBeVisible();
  await page.locator('#back-overview').click();await expect(page.locator('.window-option').first()).toBeFocused();
});

test('전환 API가 없어도 이동·저장·뒤로 가기가 동작한다',async({page})=>{
  await page.evaluate(()=>{document.startViewTransition=undefined;});
  await chooseFirstWindow(page);
  await page.getByRole('button',{name:'오사카 여행 저장',exact:true}).click();
  await page.locator('#nav-saved').click();await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.goBack();await expect(page.locator('#trip-results')).toBeVisible();
  await page.locator('#nav-home').click();await expect(page.locator('#planner')).toBeVisible();
});
