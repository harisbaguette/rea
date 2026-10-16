import {chromium, webkit} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {readPassword} from './access-secret.mjs';
const local = process.argv.includes('--local');
const base = local ? (process.env.TTEUM_TEST_BASE || 'https://127.0.0.1:4188') : 'https://air.bluekite.co.kr';
let password = local ? 'local-test-access-only' : await readPassword();
const results=[]; await mkdir('artifacts',{recursive:true});
for (const [name,engine,width,height] of [['mobile',chromium,390,844],['narrow',chromium,320,700],['desktop',chromium,1440,900],['safari',webkit,390,844]]) {
  const browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},ignoreHTTPSErrors:local,locale:'ko-KR'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>{if(!/challenges\.cloudflare\.com/.test(`${e.message}${e.stack}`))errors.push(e.message);}); // Turnstile's own frame probes are not page errors.
  try {
    // The human-check widget keeps its own connection open, so networkidle never settles.
    await page.goto(base,{waitUntil:'load'});await page.locator('#password').waitFor();
    await page.locator('.panel').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));
    assert.ok(new URL(page.url()).pathname==='/auth/login');
    assert.equal(await page.locator('input[type=password]').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    assert.deepEqual(axe.violations.map(v=>v.id),[]);
    await page.screenshot({path:`artifacts/access-${local?'local':'live'}-${name}.png`,fullPage:true});
    if(name==='narrow'||name==='desktop'){results.push({name,gate:true,accessibility:true,overflow:false});continue;}
    await page.getByLabel('비밀번호',{exact:true}).fill(password);
    await page.getByRole('button',{name:'비밀번호 보기',exact:true}).click();
    assert.equal(await page.locator('#password').getAttribute('type'),'text');
    await page.getByRole('button',{name:'비밀번호 숨기기',exact:true}).click();
    const human=await page.waitForFunction(()=>document.querySelector('[name=cf-turnstile-response]')?.value,null,{timeout:15000}).then(()=>true,()=>false);
    const posted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/auth/login');
    await page.getByRole('button',{name:'입장',exact:true}).click();
    const loginResponse=await posted;
    if(loginResponse.status()!==303){
      const body=await loginResponse.text();
      const message=body.match(/id="error"[^>]*>([^<]+)/)?.[1]||'서버에서 입장을 거부했습니다.';
      throw new Error(`입장 실패: HTTP ${loginResponse.status()} · ${message}`);
    }
    await page.waitForURL(url=>url.pathname==='/',{timeout:30000});
    await page.locator('#quick-period').waitFor();
    await page.waitForFunction(()=>!document.querySelector('#quick-search').inert,{timeout:60000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const health=await context.request.get(base+'/api/health');assert.equal(health.status(),200);
    const session=(await context.cookies()).find(c=>c.name==='__Host-tteum-session');
    assert.ok(session.httpOnly && session.secure && session.sameSite==='Strict');
    const copied=session.value;
    const screenshot=`artifacts/access-${local?'local':'live'}-${name}-inside.png`;
    await page.screenshot({path:screenshot,fullPage:true});
    await page.getByRole('button',{name:'로그아웃',exact:true}).click();
    await page.waitForURL(url=>url.pathname==='/auth/login');
    assert.equal((await context.request.get(base+'/api/health')).status(),401);
    const replay=await context.request.get(base+'/api/health',{headers:{Cookie:`__Host-tteum-session=${copied}`}});assert.equal(replay.status(),401);
    await page.goBack();await page.waitForTimeout(700);
    assert.equal(new URL(page.url()).pathname,'/auth/login');
    assert.deepEqual(errors,[]);
    results.push({name,gate:true,accessibility:true,human,login:true,api:true,logout:true,replayDenied:true,backProtected:true,overflow:false,errors:0});
  } finally {await browser.close();}
}
password='';
await writeFile(`artifacts/access-${local?'local':'live'}-browser.json`,JSON.stringify({base,passed:true,results},null,2));
console.log(JSON.stringify({passed:true,base,results}));
