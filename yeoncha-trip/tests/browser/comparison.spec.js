import {test,expect} from '@playwright/test';
import {mockFlights} from './fixtures.js';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-14T03:00:00Z'));await mockFlights(page);await page.goto('/');await expect(page.locator('.flight-card')).toHaveCount(2);});
test('연휴를 선택하기 전에 여러 연휴의 실제 요금·체류일을 함께 비교',async({page})=>{
  await expect(page.locator('#overview-status')).toContainText('22/22개 확인');
  await expect(page.locator('.window-option')).toHaveCount(4);
  await expect(page.locator('.window-option').first()).toContainText('210,000');
  await expect(page.locator('.window-option').nth(1)).toContainText('220,000');
  await expect(page.locator('.window-option').first()).toContainText('2박 3일');
  await expect(page.locator('.window-option').first()).toContainText('7박');
  await page.locator('#window-sort').selectOption('price');
  const prices=await page.locator('.window-fare>strong').allTextContents();
  expect(prices.every(p=>p.includes('210,000'))).toBeTruthy();
  await page.getByRole('button',{name:/연휴 4개 더 보기/}).click();
  await expect(page.locator('.window-option')).toHaveCount(8);
});
test('같은 목적지의 2박과 7박·가격 차이·연차를 보고 긴 일정을 선택',async({page})=>{
  const card=page.locator('.flight-card').first();
  await expect(card).toContainText('2박 3일');await expect(card).toContainText('7박 8일');
  await expect(card).toContainText('+7,900원 차이');
  await expect(card.locator('.cheap-option')).toContainText('필요 연차 1일');
  await expect(card.locator('.long-option')).toContainText('필요 연차 2일');
  await card.locator('.long-option').click();
  await expect(page.locator('#detail-dialog')).toContainText('오사카, 7박 8일');
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2027-09-11.*end=2027-09-18/);
  await expect(page.locator('#detail-dialog')).toContainText('항공사·편명·출도착 시각');
});
test('조회 실패·항공권 없음 구분과 연휴 요약 재시도',async({page})=>{
  await page.unroute('**/api/overview?**');await mockFlights(page,{overviewErrorItem:true,overviewEmptyItem:true});await page.reload();
  await expect(page.locator('.window-option').nth(1)).toContainText('가격 조회 실패');
  await expect(page.locator('.window-option').nth(2)).toContainText('조회된 항공권 없음');
  await expect(page.locator('.window-option').nth(1).locator('.window-fare')).toHaveCount(0);
  await page.unroute('**/api/overview?**');await mockFlights(page,{overviewFailFirst:true});await page.reload();
  await expect(page.locator('#overview-status')).toContainText('응답하지 않습니다');
  await page.getByRole('button',{name:'연휴 가격 다시 조회'}).click();
  await expect(page.locator('#overview-status')).toContainText('22/22개 확인');
});
test('늦은 이전 공항의 연휴 가격이 새 조건을 덮지 않는다',async({page})=>{
  await page.unroute('**/api/overview?**');await mockFlights(page,{overviewDelayFirst:true});await page.reload();
  await page.getByLabel('출발 공항',{exact:true}).selectOption('PUS');
  await expect(page.locator('.window-option').first()).toContainText('190,000');
  await page.waitForTimeout(500);await expect(page.locator('.window-option').first()).toContainText('190,000');
});
test('연말연시 직접 입력·새로고침과 정확한 귀국편 날짜 유지',async({page})=>{
  await page.locator('#custom-open').click();await page.getByLabel('휴가 시작일',{exact:true}).fill('2026-12-31');
  await page.getByLabel('휴가 마지막 날',{exact:true}).fill('2027-01-03');
  await expect(page.locator('#custom-error')).toHaveText('');
  await page.getByRole('button',{name:'이 일정으로 여행지 보기'}).click();
  await expect(page.locator('#selected-window')).toContainText('2027.1.3');
  await page.locator('.preference-disclosure>summary').click();await page.getByLabel('출발·귀국편 날짜 고정').check();
  await page.getByRole('button',{name:'오사카 항공권 상세 보기',exact:true}).click();
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2026-12-31.*end=2027-01-02/);
  await page.reload();await expect(page.locator('#detail-dialog')).toBeVisible();
  await expect(page.locator('.seller-row').first()).toHaveAttribute('href',/start=2026-12-31.*end=2027-01-02/);
});
test('상세 뒤로·앞으로·공유 주소를 열어도 같은 긴 여정을 복원',async({page})=>{
  await page.locator('.long-option').first().click();const url=page.url();
  await expect(page.locator('#detail-title')).toContainText('7박 8일');
  await page.goBack();await expect(page.locator('#detail-dialog')).not.toBeVisible();
  await page.goForward();await expect(page.locator('#detail-title')).toContainText('7박 8일');
  await page.reload();await expect(page.locator('#detail-title')).toContainText('7박 8일');
  await page.goto(url);await expect(page.locator('#detail-title')).toContainText('7박 8일');
  await page.keyboard.press('Escape');await expect(page.locator('#detail-dialog')).not.toBeVisible();
  await expect(page).not.toHaveURL(/offer=/);
});
test('불가능한 숙박 조건을 최소1박으로 바꾸어 같은 휴가에서 복구',async({page})=>{
  await page.locator('#custom-open').click();await page.getByLabel('휴가 시작일',{exact:true}).fill('2027-06-05');
  await page.getByLabel('휴가 마지막 날',{exact:true}).fill('2027-06-07');await page.getByRole('button',{name:'이 일정으로 여행지 보기'}).click();
  await expect(page.locator('#flight-grid')).toContainText('이 날짜에 조회된 항공권이 없어요');
  await page.getByRole('button',{name:'최소 1박으로 다시 조회'}).click();
  await expect(page.locator('.flight-card')).toHaveCount(2);await expect(page.locator('#preference-summary')).toContainText('1박 이상');
});
test('작은 화면·확대에서 가격과 주요 터치 조작이 가려지지 않는다',async({page})=>{
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const targets=await page.locator('.offer-option,.card-save,.icon-button,#origin,#year,#window-sort,#flight-sort,#budget').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})).filter(el=>el.width>0));
    expect(targets.every(r=>r.width>=44 && r.height>=44)).toBeTruthy();
  }
});
