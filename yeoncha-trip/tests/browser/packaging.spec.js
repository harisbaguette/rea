import {test,expect} from '@playwright/test';
import {mockFlights} from './fixtures.js';

test('배포 첫 화면은 추가 CSS·JS·글꼴·공항 그림 요청 없이 동작하고 미승인 스크립트 차단',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await mockFlights(page);
 const paths=[];page.on('request',r=>{if(r.url().startsWith('http'))paths.push(new URL(r.url()).pathname);});
 const response=await page.goto('/');const policy=response.headers()['content-security-policy'];
 test.skip(!policy,'개발 서버는 분리된 원본 모듈을 제공하고 배포 산출물에서 이 계약을 검사한다.');
 await expect(page.locator('.window-fare').first()).toBeVisible();
 expect(policy).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
 expect(policy.split('script-src ')[1].split(';')[0]).not.toContain('unsafe-inline');
 expect(paths.filter(p=>/\.(css|js|woff2)$|airport-lounge|icons\.svg/.test(p))).toEqual([]);
 await expect(page.locator('.airport-illustration img')).toHaveJSProperty('complete',true);
 expect(await page.locator('.airport-illustration img').evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);
 await page.locator('#quick-period').selectOption('2026-12');await page.locator('#search-submit').click();await expect(page).toHaveURL(/month=12/);
 await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.__unexpectedExecution=true';document.body.append(script);});
 expect(await page.evaluate(()=>window.__unexpectedExecution)).toBeUndefined();
});
