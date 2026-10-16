import {test,expect} from '@playwright/test';
import {mockFlights,chooseFirstWindow} from './fixtures.js';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);await page.goto('/');await expect(page.locator('.window-fare').first()).toBeVisible();});

test('모바일 하단 메뉴에서 달력·저장을 열고 연휴로 돌아온다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const nav=page.locator('.app-navigation');const box=await nav.boundingBox();expect(box.y+box.height).toBe(844);
 await page.locator('#nav-calendar').click();await expect(page.locator('#custom-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#nav-calendar')).toBeFocused();
 await chooseFirstWindow(page);await page.getByRole('button',{name:'오사카 여행 저장',exact:true}).click();await page.locator('#nav-saved').click();await expect(page.locator('.saved-card')).toHaveCount(1);await expect(page.locator('#nav-saved')).toHaveAttribute('aria-current','page');
 await page.locator('#nav-home').click();await expect(page.locator('#planner')).toBeVisible();await expect(page.locator('#nav-home')).toHaveAttribute('aria-current','page');
 const cat=await page.locator('.recommendation-mascot').boundingBox();expect(cat.height).toBeGreaterThanOrEqual(100);
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));const last=await page.locator('[data-more-windows]').boundingBox();expect(last.y+last.height).toBeLessThan(box.y);
});

test('연차로 연결하는 날짜는 색·기호·이름으로 구분하고 연휴 전체를 선택한다',async({page})=>{
 await page.locator('#nav-calendar').click();await page.getByRole('button',{name:'크리스마스',exact:true}).click();
 const bridge=page.locator('[data-custom-day="2026-12-24"]');await expect(bridge).toHaveAttribute('aria-label',/연차로 연휴 연결 가능/);await expect(bridge).toContainText('+');
 const colors=await page.evaluate(()=>['2026-12-24','2026-12-25','2026-12-16'].map(d=>getComputedStyle(document.querySelector(`[data-custom-day="${d}"]`)).backgroundColor));expect(new Set(colors).size).toBe(3);
 await page.locator('[data-holiday-range="2026-12-23_2026-12-27"]').click();await expect(page.locator('#custom-start')).toHaveValue('2026-12-23');await expect(page.locator('#custom-end')).toHaveValue('2026-12-27');await expect(page.locator('#custom-preview')).toContainText('휴가 5일연차 2일');
 await page.getByRole('button',{name:'이 날짜로 검색'}).click();await expect(page).toHaveURL(/start=2026-12-23&end=2026-12-27/);await expect(page.locator('.flight-card').first()).toBeVisible();
});

test('날짜별 참고가는 국가와 구분하고 실제 항공편 조회를 상세에서 제공한다',async({page})=>{
 await chooseFirstWindow(page);
 await expect(page.locator('.destination-country').first()).toContainText('일본');await expect(page.locator('.destination-country .country-flag').first()).toHaveAttribute('src','/assets/flags/jp.svg');
 await expect(page.locator('.offer-price').first()).toContainText('210,000');await expect(page.locator('#fare-status')).toContainText('참고가');await expect(page.locator('.flight-card').first()).not.toContainText('2박 3일');
 await page.locator('.destination-name').first().click();await expect(page.locator('#live-flight-panel')).toBeVisible();await expect(page.locator('.live-error')).toBeVisible();
 await page.locator('.collected-fares>summary').click();await expect(page.locator('.detail-truth')).toContainText('예약 시 가격·좌석이 달라질 수 있어요');
 await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2026-10-15&end=2026-10-17/);
});
