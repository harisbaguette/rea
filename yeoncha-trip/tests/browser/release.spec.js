import {test,expect} from '@playwright/test';import {mockFlights} from './fixtures.js';

test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);});

test('공유한 여행 링크는 보이지 않는 전체 연휴를 조회하지 않는다',async({page})=>{
  const overview=[];page.on('request',r=>{if(r.url().includes('/api/overview?'))overview.push(r.url());});
  await page.goto('/?origin=PUS&start=2026-11-05&end=2026-11-08&exact=1&buffer=0&minNights=1');await expect(page.locator('.flight-card').first()).toBeVisible();expect(overview).toHaveLength(0);
  await page.locator('#back-overview').click();await expect(page.locator('.window-fare').first()).toBeVisible();expect(overview).toHaveLength(1);await expect(page.locator('#search-context')).toContainText('부산·김해');
});

test('호스팅 오류 HTML 응답을 기술 오류 대신 복구 가능한 안내로 표시한다',async({page})=>{
  await page.route('**/api/flights?**',r=>r.fulfill({status:502,contentType:'text/html',body:'<html><body>Gateway failed</body></html>'}));
  await page.goto('/?start=2026-11-05&end=2026-11-08&exact=1&buffer=0');
  await expect(page.locator('#flight-grid')).toContainText('연결이 원활하지 않아요');await expect(page.locator('#flight-grid')).not.toContainText(/Unexpected|JSON|DOCTYPE|Gateway/);
  await page.unroute('**/api/flights?**');await mockFlights(page);await page.getByRole('button',{name:'같은 조건으로 다시 조회'}).click();await expect(page.locator('.flight-card').first()).toBeVisible();
});

test('저장 화면의 공유 주소는 사용자 선택 전까지 운임을 조회하지 않는다',async({page})=>{
  const api=[];page.on('request',r=>{if(/\/api\/(overview|flights)\?/.test(r.url()))api.push(r.url());});
  await page.goto('/?view=saved&start=2026-11-05&end=2026-11-08&exact=1&buffer=0');await expect(page.locator('#saved-view')).toBeVisible();expect(api).toHaveLength(0);
  await page.locator('#nav-home').click();await expect(page.locator('.window-fare').first()).toBeVisible();
});

test('서비스 안내는 모바일에서 읽을 수 있고 라이선스 링크가 실제로 열린다',async({page})=>{
  await page.goto('/about.html');await expect(page.getByRole('heading',{name:'서비스·데이터 안내',exact:true})).toBeVisible();
  await page.locator('summary').click();
  for(const a of await page.locator('a[href^="/assets/"]').all())expect((await page.request.get(await a.getAttribute('href'))).ok()).toBe(true);
  await page.setViewportSize({width:320,height:568});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const {default:AxeBuilder}=await import('@axe-core/playwright');const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
});
