import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const base = new URL(option("--base", "http://127.0.0.1:4179"));
assert.ok(["http:", "https:"].includes(base.protocol) && !base.username && !base.password);
const today = new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul"}).format(new Date());
const output = option("--output", "artifacts/smoke-check.json");
const prefix = option("--screenshots", "smoke");
const engines = option("--engines", "desktop,mobile").split(",");
const results = [];
await mkdir("artifacts", { recursive: true });
for (const name of engines) {
  const mobile = name === "mobile";
  const engine = name === "webkit" ? webkit : chromium;
  const viewport = mobile ? {width:390,height:844} : {width:1440,height:1000};
  const browser = await engine.launch({headless:true});
  try {
    const page = await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
    const errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => requests.push(new URL(request.url()).pathname));
    const started = performance.now();
    const pending = page.waitForResponse(response => response.url().includes("/api/overview?"), {timeout:45000});
    await page.goto(base.href);
    const response = await pending;
    assert.equal(response.status(),200);
    const overview = await response.json();
    assert.equal(overview.today,today);
    assert.equal(overview.year,Number(today.slice(0,4)));
    assert.ok(overview.windows.every(window=>window.start>=today));
    const ready = page.locator("[data-window]").filter({has:page.locator(".window-fare")}).first();
    await ready.waitFor({timeout:45000});
    const chosenWindow = await ready.getAttribute("data-window");
    const initialLayout = await page.evaluate(()=>({
      firstPrice:Math.round(document.querySelector(".window-fare").getBoundingClientRect().top+scrollY),
      firstDestination:Math.round(document.querySelector(".window-preview b").getBoundingClientRect().top+scrollY),
      bodyText:document.body.innerText.length,
      overflow:document.documentElement.scrollWidth>innerWidth,
    }));
    assert.equal(initialLayout.overflow,false);
    assert.ok(initialLayout.firstPrice<844,"첫 가격이 모바일 한 화면 안에 있어야 합니다.");
    await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).every(a=>a.playState==='finished'));
    await page.screenshot({path:`artifacts/${prefix}-${name}-initial.png`});
    const faresPending = page.waitForResponse(response=>response.url().includes("/api/flights?"),{timeout:45000});
    await ready.click();
    const faresResponse = await faresPending;
    assert.equal(faresResponse.status(),200);
    const fares = await faresResponse.json();
    assert.ok(fares.flights.length>0);
    assert.ok(fares.flights.every(flight=>flight.start>=today && flight.price>0));
    await page.locator(".flight-card").first().waitFor();
    assert.equal(await page.locator("#planner").isVisible(),false);
    await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).every(a=>a.playState==='finished'));
    await page.screenshot({path:`artifacts/${prefix}-${name}-results.png`});
    const offer = page.locator(".offer-option").first();
    const offerId = await offer.getAttribute("data-detail");
    await offer.click();
    await page.locator("#detail-dialog").waitFor();
    const shared = new URL(page.url());
    assert.ok(shared.searchParams.has("offer"));
    const detailSnapshot = {
      city:await page.locator("#detail-title").innerText(),
      journey:await page.locator(".journey-line").innerText(),
    };
    assert.match(await page.locator("#detail-dialog").innerText(),/실제 여행 시간은 판매처에서 확인/);
    const seller = page.locator(".seller-row").first();
    const sellerRect = await seller.boundingBox();
    assert.ok(sellerRect.y<viewport.height,"판매처 행동을 첫 상세 화면에서 찾을 수 있어야 합니다.");
    const path = await seller.getAttribute("href");
    const booking = await fetch(new URL(path,base),{redirect:"manual"});
    assert.equal(booking.status,302);
    assert.equal(new URL(booking.headers.get("location")).protocol,"https:");
    await page.locator("[data-detail-save]").click();
    assert.equal(await page.locator("#saved-count").innerText(),"1");
    await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).every(a=>a.playState==='finished'));
    await page.screenshot({path:`artifacts/${prefix}-${name}-detail.png`});
    await page.goBack();
    assert.equal(await page.locator("#detail-dialog").isVisible(),false);
    await page.goForward();
    await page.locator("#detail-dialog").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("offer"),shared.searchParams.get("offer"));
    assert.deepEqual({city:await page.locator("#detail-title").innerText(),journey:await page.locator(".journey-line").innerText()},detailSnapshot);
    await page.reload();
    await page.locator("#detail-dialog").waitFor({timeout:45000});
    assert.equal(new URL(page.url()).searchParams.get("offer"),shared.searchParams.get("offer"));
    assert.deepEqual({city:await page.locator("#detail-title").innerText(),journey:await page.locator(".journey-line").innerText()},detailSnapshot);
    await page.keyboard.press("Escape");
    await page.locator("#back-overview").click();
    await page.locator("#planner").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("stage"),"overview");
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(errors,[]);
    assert.equal(requests.some(path=>path==="/api/history"),false);
    const assets = await page.evaluate(()=>({
      favicon:document.querySelector('link[rel="icon"]')?.getAttribute("href"),
      logoLoaded:document.querySelector(".brand img").naturalWidth>0,
      og:document.querySelector('meta[property="og:image"]')?.content,
    }));
    assert.equal(assets.logoLoaded,true);
    assert.match(assets.favicon,/brand/);
    results.push({engine:name,today,overviewYear:overview.year,checkedWindows:overview.windows.length,
      chosenWindow,initialLayout,flights:fares.flights.length,sharedOffer:shared.searchParams.get("offer"),
      sellerFirstScreen:true,sellerHttps:true,saved:true,navigationRestored:true,historyRequests:0,
      assets,elapsedMs:Math.round(performance.now()-started),errors});
    console.log(`${name}: 오늘 이후 연휴·실제 운임·판매처·저장·공유복원·반응형 확인`);
  } finally { await browser.close(); }
}
await writeFile(output,JSON.stringify({base:base.href,today,results},null,2));
