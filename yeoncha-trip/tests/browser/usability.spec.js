import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mockFlights,chooseFirstWindow} from './fixtures.js';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);await page.goto('/');await expect(page.locator('.window-fare').first()).toBeVisible();});
test('연차는 필터에서만 조정하고 연차 없이 찾기를 적용',async({page})=>{
 await expect(page.locator('.quick-leave')).toHaveCount(0);
 await page.locator('#settings-open').click();await page.locator('#leave-limit').selectOption('0');await page.getByRole('button',{name:'이 조건으로 찾기',exact:true}).click();
 await expect(page).toHaveURL(/leave=0.*minNights=1.*buffer=0/);
 await expect(page.locator('#settings-dialog')).not.toBeVisible();
 await expect(page.locator('.window-option').first()).toContainText('연차 0일');
 await chooseFirstWindow(page);await expect(page.locator('#active-preferences')).toContainText('1박 이상');
 await expect(page.locator('.offer-itinerary').first()).toContainText('연차 0일');
});
test('떠날 시기를 바로 바꾸면 그 출발월만 조회하고 선택을 URL로 복원',async({page})=>{
 await page.locator('#quick-period').selectOption('2027-9');await page.locator('#search-submit').click();
 await expect(page.locator('.window-option').first()).toContainText('9.');
 const starts=await page.locator('[data-window]').evaluateAll(nodes=>nodes.map(n=>n.dataset.window.split('_')[0]));
 expect(starts.length).toBeGreaterThan(0);expect(starts.every(s=>s.startsWith('2027-09'))).toBeTruthy();
 await chooseFirstWindow(page);const url=page.url();await page.reload();
 await expect(page.locator('.flight-card').first()).toBeVisible();expect(page.url()).toBe(url);
 await expect(page.locator('#quick-period')).toHaveValue('2027-9');
});
test('달력에서 시작일·마지막 날 선택하고 실제 여행 날짜로 진행',async({page})=>{
 await page.getByRole('button',{name:'직접 날짜 선택',exact:true}).click();
 await page.locator('[data-custom-next]').click();
 await page.locator('[data-custom-day="2026-11-05"]').click();
 await expect(page.locator('#custom-date-hint')).toContainText('귀국편 출발일');
 await page.locator('[data-custom-day="2026-11-08"]').click();
 await expect(page.locator('#custom-start')).toHaveValue('2026-11-05');
 await expect(page.locator('#custom-end')).toHaveValue('2026-11-08');
 await expect(page.locator('#custom-preview')).toContainText('연차 2일');
 await page.getByRole('button',{name:'이 날짜로 검색'}).click();
 await expect(page).toHaveURL(/start=2026-11-05&end=2026-11-08/);
 await expect(page.locator('.offer-itinerary').first()).toContainText('11.5');
});
test('날짜 달력의 방향키는 한 칸씩 이동하며 주간 구조를 제공',async({page})=>{
 await page.getByRole('button',{name:'직접 날짜 선택',exact:true}).click();
 await page.locator('[data-custom-day="2026-10-15"]').focus();await page.keyboard.press('ArrowRight');
 await expect(page.locator('[data-custom-day="2026-10-16"]')).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(page.locator('[data-custom-day="2026-10-23"]')).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('#custom-start')).toHaveValue('2026-10-23');
 const tabs=await page.locator('#custom-calendar [tabindex="0"]').count();expect(tabs).toBe(1);
 await expect(page.locator('#custom-calendar [role="row"]')).toHaveCount(5);
});
test('결과에서 출발 공항만 바꾸면 일정 맥락을 유지하고 가격 재조회',async({page})=>{
 await chooseFirstWindow(page);const start=new URL(page.url()).searchParams.get('start');
 await page.locator('#quick-origin').selectOption('PUS');await page.locator('#search-submit').click();
 await expect(page.locator('#trip-results')).toBeVisible();await expect(page.locator('.offer-price').first()).toContainText('190,000');
 expect(new URL(page.url()).searchParams.get('start')).toBe(start);
 await page.locator('.destination-name').first().click();await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/origin=PUS/);
});
test('저장 삭제를 되돌리고 재방문에서도 보존',async({page})=>{
 await chooseFirstWindow(page);await page.getByRole('button',{name:'오사카 여행 저장',exact:true}).click();await page.locator('#nav-saved').click();
 await page.getByRole('button',{name:'오사카 저장 삭제'}).click();await expect(page.locator('.saved-card')).toHaveCount(0);
 await page.getByRole('button',{name:'되돌리기',exact:true}).click();await expect(page.locator('.saved-card')).toHaveCount(1);
 await page.reload();await expect(page.locator('.saved-card')).toHaveCount(1);
});
test('기존 다크 설정과 시스템 테마에도 밝은 화면만 제공하고 도움말 버튼 제거',async({page})=>{
 await page.evaluate(()=>localStorage.setItem('tteum.theme','dark'));await page.emulateMedia({colorScheme:'dark'});await page.reload();
 await expect(page.locator('#theme-toggle,#help-open,#footer-help')).toHaveCount(0);
 expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('light');
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
});
test('11월을 고른 뒤 직접 날짜를 열어도 그 달과 연차 한도 유지',async({page})=>{
 await page.locator('#quick-period').selectOption('2026-11');await page.locator('#search-submit').click();
 await expect(page.locator('.window-option').first()).toContainText('11.');
 await page.getByRole('button',{name:'직접 날짜 선택',exact:true}).click();
 await expect(page.locator('#custom-calendar-title')).toHaveText('2026년 11월');
 await expect(page.locator('#custom-start')).toHaveValue(/^2026-11-/);
 await expect(page.locator('#custom-preview')).not.toContainText('더 필요해요');
 await page.keyboard.press('Escape');await expect(page.locator('#quick-period')).toHaveValue('2026-11');
});
test('초기화와 첫 요금 표시 뒤에도 화면 배치가 크게 움직이지 않음',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{window.__initialShift=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__initialShift+=e.value;}).observe({type:'layout-shift',buffered:true});});
 for(const pattern of ['**/src/app.js','**/assets/app-*.js'])await page.route(pattern,async route=>{await new Promise(resolve=>setTimeout(resolve,900));await route.continue();});
 await page.reload();await expect(page.locator('.window-fare').first()).toBeVisible();await page.waitForTimeout(150);
 expect(await page.evaluate(()=>window.__initialShift)).toBeLessThanOrEqual(.1);
});

test('달력의 한 날짜는 시작일을 선택하고 마지막 날을 고른 뒤 조회',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-calendar-day="2026-10-22"]').click();
 await expect(page.locator('#custom-dialog')).toBeVisible();
 await expect(page.locator('#trip-results')).not.toBeVisible();
 await expect(page.locator('#custom-start')).toHaveValue('2026-10-22');
 await expect(page.locator('#custom-end')).toHaveValue('');
 await expect(page.locator('#custom-date-hint')).toContainText('귀국편 출발일');
 await expect(page.locator('#custom-error')).toHaveText('');
 await expect(page.locator('[data-custom-day="2026-10-22"]')).toBeFocused();
 await page.locator('[data-custom-day="2026-10-25"]').click();
 await expect(page.locator('#custom-end')).toHaveValue('2026-10-25');
 await page.getByRole('button',{name:'이 날짜로 검색'}).click();
 await expect(page).toHaveURL(/start=2026-10-22&end=2026-10-25/);
 await expect(page.locator('.flight-card').first()).toBeVisible();
});

test('예산을 넘는 요금을 추천 목록에서 구분하고 필터를 취소·초기화',async({page})=>{
 await page.locator('#settings-open').click();
 await page.getByLabel('1인 왕복 예산').selectOption('200000');
 await page.getByRole('button',{name:'이 조건으로 찾기',exact:true}).click();
 await expect(page.locator('.window-fare')).toHaveCount(0);
 await expect(page.locator('#window-list')).toContainText('확인한 일정은 예산을 넘어요');
 await expect(page.locator('#filter-count')).toHaveText('1');
 await expect(page.locator('.unpriced-list>summary')).toContainText('예산을 넘는 일정 4개');
 await page.locator('#settings-open').click();await page.getByRole('button',{name:'초기화',exact:true}).click();
 await page.keyboard.press('Escape');await expect(page.locator('#filter-count')).toHaveText('1');
 await page.locator('#settings-open').click();await expect(page.getByLabel('1인 왕복 예산')).toHaveValue('200000');
 await page.getByRole('button',{name:'초기화',exact:true}).click();await page.getByRole('button',{name:'이 조건으로 찾기',exact:true}).click();
 await expect(page.locator('.window-fare')).toHaveCount(4);await expect(page.locator('#filter-count')).not.toBeVisible();
 await chooseFirstWindow(page);await page.getByRole('button',{name:'일본',exact:true}).click();await expect(page.locator('#filter-count')).toHaveText('1');
});

test('추천 요금 응답이 와도 선택 중인 추천 버튼의 키보드 초점을 유지',async({page})=>{
 await page.unroute('**/api/overview?**');await mockFlights(page,{overviewDelayFirst:true});await page.reload();
 const pick=page.locator('.schedule-pick.efficient');await pick.focus();await expect(page.locator('.window-fare').first()).toBeVisible();await expect(pick).toBeFocused();
});
