import {test,expect} from '@playwright/test';
import {mockFlights} from './fixtures.js';

test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));
  await mockFlights(page);await page.goto('/');await expect(page.locator('.window-fare').first()).toBeVisible();
});

test('검색창 직접 날짜와 선택 중인 공항을 한 번에 검색하고 고른 날짜를 판매처에 전달한다',async({page})=>{
  const queries=[];page.on('request',r=>{if(r.url().includes('/api/flights?'))queries.push(Object.fromEntries(new URL(r.url()).searchParams));});
  await page.locator('#quick-origin').selectOption('PUS');
  await page.locator('#quick-period').selectOption('custom');
  await expect(page.locator('#custom-origin')).toContainText('부산·김해');
  await page.getByLabel('출발일',{exact:true}).fill('2026-11-05');
  await page.getByLabel('귀국편 출발일',{exact:true}).fill('2026-11-08');
  expect(queries).toHaveLength(0);
  await page.getByRole('button',{name:'이 날짜로 검색',exact:true}).click();
  await expect(page.locator('.flight-card').first()).toBeVisible();
  expect(queries).toEqual([expect.objectContaining({origin:'PUS',start:'2026-11-05',end:'2026-11-08',exact:'1',buffer:'0',minNights:'1'})]);
  await expect(page.locator('.offer-itinerary').first()).toContainText('11.5');
  await expect(page.locator('.offer-itinerary').first()).toContainText('11.8');
  await expect(page.locator('.offer-price').first()).toContainText('190,000');
  await expect(page.locator('#active-preferences')).toHaveText('선택한 날짜');
  await page.getByRole('button',{name:'오사카 항공권 상세 보기',exact:true}).click();
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/origin=PUS.*start=2026-11-05.*end=2026-11-08/);
  await page.reload();await expect(page.locator('#detail-dialog')).toBeVisible();
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/origin=PUS.*start=2026-11-05.*end=2026-11-08/);
});

test('날짜 선택 취소는 공항·월 초안을 보존하고 요청을 보내지 않는다',async({page})=>{
  const requests=[];page.on('request',r=>{if(/\/api\/(flights|overview)\?/.test(r.url()))requests.push(r.url());});const before=page.url();
  await page.locator('#quick-origin').selectOption('PUS');await page.locator('#quick-period').selectOption('2027-9');
  await page.locator('#quick-period').selectOption('custom');
  await expect(page.locator('#custom-calendar-title')).toHaveText('2027년 9월');
  await page.locator('#custom-start').fill('2027-09-20');await page.keyboard.press('Escape');
  await expect(page.locator('#quick-period')).toBeFocused();await expect(page.locator('#quick-period')).toHaveValue('2027-9');
  await expect(page.locator('#quick-origin')).toHaveValue('PUS');expect(page.url()).toBe(before);expect(requests).toHaveLength(0);
  await page.locator('#search-submit').click();await expect(page.locator('#search-context')).toContainText('부산·김해');
});

test('1박·해넘김 일정도 날짜를 바꾸지 않고 검색하며 뒤로 가기로 조건이 복원된다',async({page})=>{
  const before=page.url();await page.locator('#quick-period').selectOption('custom');
  await page.locator('#custom-start').fill('2026-12-31');await page.locator('#custom-end').fill('2027-01-01');
  const request=page.waitForRequest('**/api/flights?**');await page.getByRole('button',{name:'이 날짜로 검색',exact:true}).click();
  const q=new URL((await request).url()).searchParams;expect(q.get('end')).toBe('2027-01-01');expect(q.get('buffer')).toBe('0');
  await expect(page.locator('.flight-card').first()).toContainText('날짜상 1박');
  await page.goBack();await expect(page).toHaveURL(before);await expect(page.locator('#planner')).toBeVisible();
  await page.goForward();await expect(page.locator('.offer-itinerary').first()).toContainText('1.1');
});

test('과거·역전·너무 긴 날짜를 막고 고친 날짜로 진행한다',async({page})=>{
  await page.locator('#quick-period').selectOption('custom');
  await page.locator('#custom-start').fill('2026-10-14');await expect(page.locator('#custom-error')).toContainText('오늘 이후');
  await page.locator('#custom-start').fill('2026-11-05');await page.locator('#custom-end').fill('2026-11-04');await expect(page.locator('#custom-error')).toContainText('출발일 다음 날');
  await page.locator('#custom-end').fill('2026-11-22');await expect(page.locator('#custom-error')).toContainText('최대 16일');
  await page.locator('#custom-end').fill('2026-11-06');await expect(page.locator('#custom-error')).toHaveText('');
  await page.getByRole('button',{name:'이 날짜로 검색',exact:true}).click();await expect(page.locator('.flight-card').first()).toBeVisible();
});

test('고른 날짜에 요금이 없으면 날짜 변경 또는 기간 내 검색으로 복구한다',async({page})=>{
  await page.route('**/api/flights?**',async route=>{
    const q=new URL(route.request().url()).searchParams;
    if(q.get('exact')==='1'){await route.fulfill({json:{flights:[],alternatives:{},query:Object.fromEntries(q),complete:true,stale:false}});return;}
    await route.fallback();
  });
  await page.locator('#quick-period').selectOption('custom');await page.locator('#custom-start').fill('2026-11-05');await page.locator('#custom-end').fill('2026-11-08');
  await page.getByRole('button',{name:'이 날짜로 검색',exact:true}).click();await expect(page.locator('#flight-grid')).toContainText('선택한 날짜의 요금이 없어요');
  await page.getByRole('button',{name:'날짜 바꾸기',exact:true}).click();await expect(page.locator('#custom-end')).toHaveValue('2026-11-08');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'선택한 기간 안에서 다시 찾기',exact:true}).click();await expect(page.locator('.flight-card').first()).toBeVisible();await expect(page).toHaveURL(/exact=0/);
});

test('직접 고른 일정은 저장 후 새로고침해도 날짜 고정을 유지한다',async({page})=>{
  await page.locator('#quick-period').selectOption('custom');await page.locator('#custom-start').fill('2026-11-05');await page.locator('#custom-end').fill('2026-11-08');
  await page.getByRole('button',{name:'이 날짜로 검색',exact:true}).click();await expect(page.locator('.flight-card').first()).toBeVisible();
  await page.locator('[data-open-schedule]').click();await page.locator('[data-save-schedule]').click();await page.keyboard.press('Escape');
  await page.locator('#nav-saved').click();await expect(page.locator('.saved-card')).toBeVisible();await page.reload();await expect(page.locator('.saved-card')).toBeVisible();
  const pending=page.waitForRequest('**/api/flights?**');await page.locator('[data-saved-open]').click();const q=new URL((await pending).url()).searchParams;
  expect(q.get('exact')).toBe('1');expect(q.get('buffer')).toBe('0');expect(q.get('start')).toBe('2026-11-05');expect(q.get('end')).toBe('2026-11-08');
  await expect(page.locator('.offer-itinerary').first()).toContainText('11.8');
});
