import {test,expect} from '@playwright/test';
import {mockFlights,chooseFirstWindow,applySettings} from './fixtures.js';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);await page.goto('/');await expect(page.locator('.window-fare').first()).toBeVisible();});
test('초기4개만 조회하고 더보기에서 다음4개를 요청·포커스 이동',async({page})=>{
  const pages=[];page.on('request',request=>{if(request.url().includes('/api/overview?'))pages.push(new URL(request.url()).searchParams.get('page'));});
  await page.reload();await expect(page.locator('#overview-status')).toContainText('4/');expect(pages).toEqual(['1']);
  await page.locator('[data-more-windows]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#overview-status')).toContainText('8/');expect(pages).toEqual(['1','2']);
  await expect(page.locator('.window-option').nth(4)).toBeFocused();
});
test('모든 연휴 정렬의 보이는4개 운임이 조회를 마친다',async({page})=>{
  for(const sort of ['longest','leave','efficiency','earliest','price']){
    await page.locator('#overview-sort-open').click();await page.locator(`[data-window-sort="${sort}"]`).click();
    await expect(page.locator('#overview-status')).not.toContainText('확인 중');
    await expect(page.locator('.window-pending')).toHaveCount(0);await expect(page.locator('.window-fare')).toHaveCount(4);
  }
});
test('연차0의 모순된 조건을 1박·복귀여유없음으로 명시 변경',async({page})=>{
  await page.goto('/?leave=0&minNights=2&buffer=1');
  await expect(page.locator('#window-list')).toContainText('2박 + 복귀 여유 하루');
  await page.getByRole('button',{name:'1박·복귀 여유 없이 다시 찾기',exact:true}).click();
  await expect(page.locator('#condition-summary')).toContainText('1박 이상');await expect(page.locator('#condition-summary')).toContainText('복귀 여유 없음');
  await expect(page.locator('.window-fare').first()).toBeVisible();
  await expect(page.locator('.window-option').first()).toContainText('10.17');
  await chooseFirstWindow(page);await expect(page.locator('.cheap-option').first()).toContainText('날짜상 1박');
});
test('미수집 일정은 접힌 작은 묶음·실패는 별도·실제 요금 우선',async({page})=>{
  await page.unroute('**/api/overview?**');await mockFlights(page,{overviewEmptyFirst:true,overviewErrorItem:true});await page.reload();
  await expect(page.locator('.unpriced-list>summary')).toContainText('가격 없는 일정 1개');
  await expect(page.locator('.unpriced-option')).not.toBeVisible();
  await expect(page.locator('.window-option').first()).toContainText('가격 확인 실패');
  await expect(page.locator('.window-fare').first()).toBeVisible();await expect(page.locator('#overview-retry')).toBeVisible();
});
test(' 긴 대안 부분 실패를 구분하고 성공 가격 유지·재시도',async({page})=>{
  await page.unroute('**/api/overview?**');await mockFlights(page,{overviewPartial:true});await page.reload();
  await expect(page.locator('.window-option').first()).toContainText('210,000');await expect(page.locator('.window-warning').first()).toContainText('긴 일정 조회 실패');
  await page.unroute('**/api/overview?**');await mockFlights(page);await page.locator('#overview-retry').click();
  await expect(page.locator('.window-option').first()).toContainText('210,000');await expect(page.locator('.window-warning')).toHaveCount(0);
});
test('같은 목적지 싼2박과 긴7박의 가격·연차를 비교·선택',async({page})=>{
  await page.goto('/?year=2027&start=2027-09-11&end=2027-09-19&stage=results');
  await expect(page.locator('.flight-card').first()).toContainText('날짜상 2박');await expect(page.locator('.flight-card').first()).toContainText('날짜상 7박');
  await expect(page.locator('.long-option').first()).toContainText('+7,900원 차이');
  await page.locator('.long-option').first().click();await expect(page.locator('.journey-duration')).toContainText('날짜상 7박');
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2027-09-11.*end=2027-09-18/);
});
test('목적지·상세 뒤로/앞으로·직접 공유·새로고침 복원',async({page})=>{
  await chooseFirstWindow(page);const chosen=new URL(page.url()).searchParams.get('start');
  await page.locator('.cheap-option').first().click();const shared=page.url();
  await page.goBack();await expect(page.locator('#detail-dialog')).not.toBeVisible();
  await page.goForward();await expect(page.locator('#detail-dialog')).toBeVisible();
  await page.reload();await expect(page.locator('#detail-dialog')).toBeVisible();
  await page.goto(shared);await expect(page.locator('#detail-dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/offer=/);await expect(page.locator('.destination-name').first()).toBeFocused();await page.locator('#back-overview').click();
  await expect(page.locator('#planner')).toBeVisible();await expect(page.locator(`[data-window^="${chosen}"]`).first()).toBeFocused();
});
test('동일 조건 갱신은 운임을 보존하고 실패를 이전 요금으로 표시',async({page})=>{
  await chooseFirstWindow(page);await page.unroute('**/api/flights?**');
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/flights?**',async route=>{await gate;await route.fulfill({status:503,json:{error:{message:'제공처 응답 실패'}}});});
  await page.locator('#refresh-flights').click();await expect(page.locator('.flight-card')).toHaveCount(2);await expect(page.locator('#fare-status')).toContainText('갱신 중');
  release();await expect(page.locator('#flight-grid')).toContainText('갱신에 실패해 이전 가격을 표시합니다');await expect(page.locator('.flight-card')).toHaveCount(2);
});
test('초기 응답과 더보기 응답이 와도 키보드 위치를 보존',async({page})=>{
  await page.unroute('**/api/overview?**');await mockFlights(page,{overviewDelayFirst:true});await page.reload();
  const first=page.locator('.window-option').first();await first.focus();const id=await first.getAttribute('data-window');
  await expect(page.locator('.window-fare').first()).toBeVisible();await expect(page.locator(`[data-window="${id}"]`)).toBeFocused();
});
test('탭 재진입에서 KST 자정이 지나면 오늘·지난 추천을 재계산',async({page})=>{
  await page.unroute('**/api/overview?**');await mockFlights(page,{today:'2026-10-16'});
  await page.clock.setFixedTime(new Date('2026-10-15T15:01:00Z'));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#today-caption')).toContainText('10.16');
  const starts=await page.locator('[data-window]').evaluateAll(nodes=>nodes.map(n=>n.dataset.window.split('_')[0]));expect(starts.every(date=>date>='2026-10-16')).toBeTruthy();
});
test('탭을 계속 보고 있어도 한국 자정 타이머가 오늘을 갱신',async({page})=>{
  await page.clock.install({time:new Date('2026-10-15T14:59:00Z')});await page.reload();
  await expect(page.locator('#today-caption')).toContainText('10.15');
  await page.unroute('**/api/overview?**');await mockFlights(page,{today:'2026-10-16'});
  await page.clock.fastForward(120000);await expect(page.locator('#today-caption')).toContainText('10.16');
  const starts=await page.locator('[data-window]').evaluateAll(nodes=>nodes.map(n=>n.dataset.window.split('_')[0]));expect(starts.every(date=>date>='2026-10-16')).toBeTruthy();
});
test('저장 요금 대기 중 다른 일정을 선택하면 이전 상세가 열리지 않음',async({page})=>{
  await chooseFirstWindow(page);await page.getByRole('button',{name:'오사카 여행 저장',exact:true}).click();await page.locator('#nav-saved').click();
  await page.unroute('**/api/flights?**');await mockFlights(page);
  let release,held=false,requests=0;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/flights?**',async route=>{requests++;if(!held){held=true;await gate;}await route.fallback();});
  await page.getByRole('button',{name:'현재 요금',exact:true}).click();await expect(page.locator('.result-skeleton')).toBeVisible();expect(requests).toBe(1);
  await page.locator('#back-overview').click();await page.locator('.window-option').nth(1).click();
  await expect(page.locator('.flight-card')).toHaveCount(2);const selected=new URL(page.url()).searchParams.get('start');
  release();await page.waitForTimeout(500);await expect(page.locator('#detail-dialog')).not.toBeVisible();expect(new URL(page.url()).searchParams.get('start')).toBe(selected);
});
test('떠날 달은 휴가 시작월이며 전월 항공권을 끼워 넣지 않음',async({page})=>{
  await page.locator('#quick-period').selectOption('2026-11');await page.locator('#search-submit').click();
  await expect(page.locator('.window-fare').first()).toBeVisible();
  const starts=await page.locator('[data-window]').evaluateAll(nodes=>nodes.map(n=>n.dataset.window.split('_')[0]));expect(starts.every(date=>date.startsWith('2026-11'))).toBeTruthy();
  await expect(page.locator('.window-itinerary').first()).not.toContainText('10.29');
});
test('결과에서 필터를 적용해도 날짜·목적지 단계와 초점 유지',async({page})=>{
  await chooseFirstWindow(page);const start=new URL(page.url()).searchParams.get('start');await applySettings(page,async()=>{await page.getByLabel('1인 왕복 예산').selectOption('300000');});
  await expect(page.locator('#trip-results')).toBeVisible();await expect(page.locator('#settings-open')).toBeFocused();expect(new URL(page.url()).searchParams.get('start')).toBe(start);await expect(page.locator('.flight-card')).toHaveCount(1);
});
test('개요의 요금은 유연날짜로 재현하고 직접 링크의 날짜 고정은 보존',async({page})=>{
  await page.goto('/?year=2026&start=2026-12-24&end=2026-12-28&stage=results&exact=1');
  await expect(page.locator('.cheap-option').first()).toContainText('날짜상 3박');await expect(page).toHaveURL(/exact=1/);
  await page.locator('#back-overview').click();await page.locator('#settings-open').click();
  await expect(page.locator('#exact-dates')).not.toBeVisible();await page.keyboard.press('Escape');
  await chooseFirstWindow(page);await expect(page).toHaveURL(/exact=0/);await expect(page.locator('.cheap-option').first()).toContainText('날짜상 2박');
});
