import {test,expect} from '@playwright/test';
import {mockFlights,chooseFirstWindow,applySettings} from './fixtures.js';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);await page.goto('/');await expect(page.locator('.window-fare').first()).toBeVisible();});
test('오늘의 남은 연휴에서 목적지·판매처로 바로 진행',async({page})=>{
  await expect(page).toHaveURL(/year=2026/);await expect(page.locator('#today-caption')).toContainText('10.15');
  await expect(page.locator('#trip-results')).not.toBeVisible();
  const starts=await page.locator('[data-window]').evaluateAll(nodes=>nodes.map(n=>n.dataset.window.split('_')[0]));
  expect(starts.every(date=>date>='2026-10-15')).toBeTruthy();
  await chooseFirstWindow(page);await expect(page.locator('#planner')).not.toBeVisible();
  await expect(page.locator('.flight-card')).toHaveCount(2);
  await page.getByRole('button',{name:'오사카 항공권 상세 보기',exact:true}).click();
  await expect(page.locator('#detail-dialog .seller-row')).toHaveCount(2);
  await expect(page.locator('#detail-dialog .detail-price')).toContainText('210,000');
  await expect(page.locator('#live-flight-panel')).toBeVisible();await expect(page.locator('.live-error')).toBeVisible();
  await expect(page.locator('#price-history')).toHaveCount(0);
});
test('필터 취소는 보존하고 선택한 공항에 예산을 적용',async({page})=>{
  const before=page.url();await page.locator('#settings-open').click();
  await page.getByLabel('1인 왕복 예산').selectOption('200000');await page.keyboard.press('Escape');
  await expect(page.locator('#settings-open')).toBeFocused();expect(page.url()).toBe(before);
  await page.locator('#quick-origin').selectOption('PUS');await page.locator('#search-submit').click();await applySettings(page,async()=>{await page.getByLabel('1인 왕복 예산').selectOption('200000');});
  await expect(page.locator('#condition-summary')).toContainText('부산·김해');
  await chooseFirstWindow(page);await expect(page.locator('.flight-card')).toHaveCount(1);await expect(page.locator('.flight-card')).toContainText('190,000');
});
test('지역·예산 빈 결과에서 입력을 보존해 복구',async({page})=>{
  await chooseFirstWindow(page);
  await applySettings(page,async()=>{await page.getByLabel('1인 왕복 예산').selectOption('200000');});
  await page.getByRole('button',{name:'바다',exact:true}).click();await expect(page.locator('#flight-grid')).toContainText('예산·지역에 맞는 항공권이 없어요');
  await page.getByRole('button',{name:'예산·지역 초기화'}).click();await expect(page.locator('.flight-card')).toHaveCount(2);
});
test('저장·재방문·현재 요금 재조회·삭제',async({page})=>{
  await chooseFirstWindow(page);await page.getByRole('button',{name:'오사카 여행 저장',exact:true}).click();
  await expect(page.locator('#saved-count')).toHaveText('1');await page.reload();
  await page.locator('#nav-saved').click();await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.getByRole('button',{name:'현재 요금',exact:true}).click();await expect(page.locator('#detail-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await page.locator('#nav-saved').click();await page.getByRole('button',{name:'오사카 저장 삭제'}).click();
  await expect(page.locator('#saved-list')).toContainText('다음 여행을 담아 보세요');
});
test('직접 날짜 오류 복구·해넘김·날짜 고정·새로고침',async({page})=>{
  await page.getByRole('button',{name:'직접 날짜 선택',exact:true}).click();
  await page.getByLabel('출발일',{exact:true}).fill('2026-12-31');await page.getByLabel('귀국편 출발일',{exact:true}).fill('2026-12-30');
  await expect(page.locator('#custom-error')).toContainText('출발일 다음 날');await page.getByLabel('귀국편 출발일',{exact:true}).fill('2027-01-03');
  await expect(page.locator('#custom-error')).toHaveText('');await page.getByRole('button',{name:'이 날짜로 검색'}).click();
  await expect(page.locator('#selected-window')).toContainText('2027.1.3');
  await applySettings(page,async()=>{await page.getByLabel('휴가 시작·귀국편 날짜 고정').check();});
  await page.getByRole('button',{name:'오사카 항공권 상세 보기',exact:true}).click();
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2026-12-31.*end=2027-01-03/);
  await page.reload();await expect(page.locator('#detail-dialog')).toBeVisible();
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2026-12-31.*end=2027-01-03/);
});
test('캘린더는 휴가 마지막 날을 포함',async({page})=>{
  await chooseFirstWindow(page);const start=new URL(page.url()).searchParams.get('start');
  await page.getByRole('button',{name:'선택한 연휴와 연차 일정 확인'}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'캘린더에 추가',exact:true}).click();
  const download=await pending;expect(download.suggestedFilename()).toBe(`tteum-${start}.ics`);
  const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain('DTEND;VALUE=DATE:');
});
test('잘못된 URL과 과거 날짜를 현재 조건으로 복구',async({page})=>{
  await page.goto('/?year=bad&origin=<script>&leave=99&start=2026-01-01&end=2026-01-03');
  await expect(page).toHaveURL(/year=2026/);await expect(page.locator('#condition-summary')).toContainText('인천');
  await expect(page.locator('#planner')).toBeVisible();await expect(page.locator('#trip-results')).not.toBeVisible();
});
test('저장소가 막혀도 검색·임시 저장 가능',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await page.reload();await chooseFirstWindow(page);await page.getByRole('button',{name:'오사카 여행 저장',exact:true}).click();
  await expect(page.locator('#saved-count')).toHaveText('1');await expect(page.locator('#toast')).toContainText('새로고침하면 저장이 사라져요');
});
test('운임 조회 실패 후 같은 조건 재시도',async({page})=>{
  await page.unroute('**/api/flights?**');await mockFlights(page,{failFirst:true});await page.locator('.window-option').first().click();
  await expect(page.locator('#flight-grid')).toContainText('요금을 확인하지 못했어요');
  await page.getByRole('button',{name:'같은 조건으로 다시 조회'}).click();await expect(page.locator('.flight-card')).toHaveCount(2);
});
test('늦은 이전 공항 응답은 새 공항 결과를 덮지 않음',async({page})=>{
  await page.unroute('**/api/flights?**');await mockFlights(page,{delayFirst:true});await page.locator('.window-option').first().click();
  await page.locator('#quick-origin').selectOption('PUS');await page.locator('#search-submit').click();
  await expect(page.locator('.flight-card').first()).toContainText('190,000');await page.waitForTimeout(500);await expect(page.locator('.flight-card').first()).toContainText('190,000');
});
