import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mockFlights,chooseFirstWindow} from './fixtures.js';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);await page.goto('/');await expect(page.locator('.window-fare').first()).toBeVisible();});
test('목록·조건·날짜·운임안내·일정·상세 WCAG2.2AA와 모달 포커스',async({page})=>{
  const scan=async()=>{await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).every(a=>a.playState==='finished'));const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);};
  await scan();
  for(const opener of ['#settings-open','#overview-sort-open']){await page.locator(opener).click();await scan();await page.keyboard.press('Escape');await expect(page.locator(opener)).toBeFocused();}
  const custom='#custom-open';await page.locator(custom).click();await scan();await page.keyboard.press('Escape');await expect(page.locator(custom)).toBeFocused();
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/flights?**',async route=>{await gate;await route.fallback();});
  await page.locator('.window-option').first().click();await expect(page.locator('.result-skeleton')).toBeVisible();await scan();
  release();await expect(page.locator('.flight-card')).toHaveCount(2);await scan();
  await page.locator('[data-open-schedule]').click();await scan();await page.keyboard.press('Escape');await expect(page.locator('[data-open-schedule]')).toBeFocused();
  await page.locator('.destination-name').first().click();await scan();
  await page.locator('.collected-fares>summary').click();await page.locator('.detail-truth').click();await scan();await page.keyboard.press('Escape');await expect(page.locator('.detail-truth')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('.destination-name').first()).toBeFocused();
});
test('320px·짧은 화면·모든 시트가 폭 안에 있고 터치44px·입력16px',async({page})=>{
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:568});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const targets=await page.locator('button,select').evaluateAll(nodes=>nodes.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})).filter(r=>r.w&&r.h));expect(targets.every(r=>r.w>=44&&r.h>=44)).toBeTruthy();
    await page.locator('#settings-open').click();
    const sheet=await page.locator('#settings-dialog').boundingBox();expect(sheet.x).toBeGreaterThanOrEqual(0);expect(sheet.x+sheet.width).toBeLessThanOrEqual(width+1);
    if(width<=700)expect(sheet.width).toBe(width);
    const fonts=await page.locator('#settings-dialog select').evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width).map(el=>parseFloat(getComputedStyle(el).fontSize)));expect(fonts.every(n=>n>=16)).toBeTruthy();
    await page.keyboard.press('Escape');
  }
});
test('과거 이력·노선 할인률은 기본 흐름에 노출하지 않고 사진은 깨지지 않음',async({page})=>{
  await chooseFirstWindow(page);await page.locator('.destination-name').first().click();
  await expect(page.locator('#price-history,.deal-badge,.route-average')).toHaveCount(0);
  await page.waitForFunction(()=>[...document.images].filter(img=>img.getBoundingClientRect().width).every(img=>img.complete&&img.naturalWidth>0));
});
