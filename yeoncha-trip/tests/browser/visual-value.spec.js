import { test, expect } from '@playwright/test';
import { mockFlights, chooseFirstWindow } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));
  await mockFlights(page);
  await page.goto('/');
  await expect(page.locator('.window-fare').first()).toBeVisible();
});

test('추천 일정은 현재 연차 한도에 맞고 선택한 기간으로 실제 요금을 조회', async ({ page }) => {
  const pick = page.locator('.schedule-pick.efficient');
  await expect(pick).toContainText('휴가 5일');
  const [start, end] = (await pick.getAttribute('data-recommend-window')).split('_');
  expect(start >= '2026-10-15').toBeTruthy();
  await pick.click();
  await expect(page.locator('.flight-card').first()).toBeVisible();
  const query = new URL(page.url()).searchParams;
  expect(query.get('start')).toBe(start);
  expect(query.get('end')).toBe(end);
  await expect(page.locator('#selected-window')).toContainText('연차 2일');
  await page.locator('#back-overview').click();
  await page.locator('#settings-open').click();await page.locator('#leave-limit').selectOption('0');await page.getByRole('button',{name:'이 조건으로 찾기',exact:true}).click();
  await expect(page.locator('.schedule-pick.efficient')).toContainText('연차 0일');
});

test('확인한 요금 범위와 판매처 차액을 밝히고 평소 대비 특가로 과장하지 않음', async ({ page }) => {
  let historyRequests = 0;
  page.on('request', request => { if (request.url().includes('/api/history')) historyRequests++; });
  await expect(page.locator('.fare-rank')).toHaveCount(0);
  await chooseFirstWindow(page);
  await expect(page.locator('.fare-verdict').first()).toContainText('2곳 비교 · 10,000원 차이');
  await page.locator('.fare-verdict').first().click();
  await expect(page.locator('.price-conclusion')).toContainText('10,000원');
  await expect(page.locator('.quote-comparison')).toContainText('210,000원');
  await expect(page.locator('.quote-comparison')).toContainText('220,000원');
  await expect(page.locator('.price-scope')).toContainText('항공편·수하물 조건은 다를 수');
  await expect(page.locator('.price-caveat')).toContainText('평소보다 싼지는 판단할 자료가 없어요');
  expect(historyRequests).toBe(0);
});

test('판매처 한 곳이면 비교 부족을 표시하고 구매 판단을 꾸며내지 않음', async ({ page }) => {
  await chooseFirstWindow(page);
  await expect(page.locator('.fare-verdict').nth(1)).toContainText('가격 비교 자료 부족');
  await page.locator('.fare-verdict').nth(1).click();
  await expect(page.locator('.price-conclusion')).toContainText('판매처 1곳만 있어 비교가 부족');
  await expect(page.locator('.quote-comparison')).toHaveCount(0);
  await expect(page.locator('.seller-row')).toHaveCount(1);
});

test('대기 비행기와 전환은 동작 줄이기를 따르고 실제 응답 뒤 대기를 끝냄', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/flights?**', async route => { await gate; await route.fallback(); });
  await page.locator('.window-option').first().click();
  await expect(page.locator('.flight-loading')).toBeVisible();
  expect(await page.locator('.loading-plane').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('.flight-loading')).not.toContainText('%');
  release();
  await expect(page.locator('.flight-card').first()).toBeVisible();
  await expect(page.locator('.flight-loading')).toHaveCount(0);
});

test('일러스트가 실제 로드되고 첫 왕복가는 대표 화면의 첫 뷰포트 안에 있음', async ({ page }) => {
  await page.waitForFunction(() => [...document.querySelectorAll('.airport-illustration img,.recommendation-mascot')].every(img => img.complete && img.naturalWidth > 0));
  const fare = await page.locator('.window-fare').first().boundingBox();
  expect(fare.y + fare.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('긴 조회 중 로딩 장면은 읽을 수 있고 비행기가 실제로 움직임', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/flights?**', async route => { await gate; await route.fallback(); });
  await page.locator('.window-option').first().click();
  await expect(page.locator('.flight-loading')).toBeVisible();
  await page.waitForTimeout(1250);
  expect(await page.locator('#trip-results').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  const first = await page.locator('.loading-plane').boundingBox();
  await page.waitForTimeout(350);
  const second = await page.locator('.loading-plane').boundingBox();
  expect(Math.abs(first.y - second.y)).toBeGreaterThan(.5);
  release();
  await expect(page.locator('.flight-card').first()).toBeVisible();
});

test('작은 휴대전화와 태블릿에서도 추천보다 실제 첫 가격이 화면 밖으로 밀리지 않음', async ({ page }) => {
  for (const [width, height] of [[320, 568], [1024, 844]]) {
    await page.setViewportSize({ width, height });
    const fare = await page.locator('.window-fare').first().boundingBox();
    expect(fare.y + fare.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});
