import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {AccessGuard, transition, LIMITS} from '../server/access-guard.js';
import {makeVerifier, random, sign} from '../server/access-crypto.js';
import {safeNext, protectedFetcher, clientNetwork} from '../server/access.js';

const base = 'https://air.bluekite.co.kr';
const password = 'only-a-test-password';
const secret = random() + random();
const verifier = await makeVerifier(password, secret);
const siteverify = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return realFetch(url, init);
  const body = new URLSearchParams(init.body), token = body.get('response');
  siteverify.push(Object.fromEntries(body));
  if (token === 'offline') throw new Error('offline');
  return Response.json(token === 'human-ok' ? {success: true, hostname: 'air.bluekite.co.kr', action: 'login'}
    : token === 'other-site' ? {success: true, hostname: 'evil.test', action: 'login'} : {success: false, 'error-codes': ['invalid-input-response']});
};
function environment() {
  let stored, queue = Promise.resolve();
  const object = new AccessGuard({storage: {transaction(fn) {
    const result = queue.then(() => fn({get: async () => structuredClone(stored), put: async (_, value) => {stored = structuredClone(value);}}));
    queue = result.catch(() => {}); return result;
  }}});
  const human = new Map();
  return {SESSION_SECRET: secret, PASSWORD_VERIFIER: verifier, TURNSTILE_SITE_KEY: '0x4AAAAAAAtest', TURNSTILE_SECRET: '0x4AAAAAAAsecret',
    EDGE_LIMITER: {limit: async () => ({success: true})}, LOGIN_LIMITER: {limit: async () => ({success: true})},
    HUMAN_LIMITER: {limit: async ({key}) => {human.set(key, (human.get(key) || 0) + 1); return {success: human.get(key) <= 10};}}, humanChecks: human,
    ACCESS_GUARD: {idFromName: x => x, get: () => ({fetch: (url, init) => object.fetch(new Request(url, init))})},
    state: () => stored,
  };
}
const req = (path, options = {}) => new Request(base + path, options);
const cookieOf = (response, name) => response.headers.getSetCookie().find(x => x.startsWith(name + '='))?.split(';')[0];
async function attempt(env, value = password, headers = {}, next = '/', human = '', device = '') {
  const form = await worker.fetch(req('/auth/login'), env);
  const cookie = [cookieOf(form, '__Host-tteum-csrf'), device].filter(Boolean).join('; ');
  const csrf = (await form.text()).match(/name="csrf" value="([^"]+)"/)[1];
  return worker.fetch(req('/auth/login', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Origin: base, Cookie: cookie, ...headers}, body: new URLSearchParams({password: value, csrf, next, ...(human ? {'cf-turnstile-response': human} : {})})}), env);
}
async function login(env) {
  const response = await attempt(env);assert.equal(response.status, 303);
  return cookieOf(response, '__Host-tteum-session');
}

test('unauthenticated application, source and every API are denied before upstream work', async () => {
  const env = environment();
  for (const path of ['/', '/index.html', '/about.html', '/assets/brand/symbol.svg', '/src/app.js', '/api/book?origin=ICN', '/api/health', '/api/overview', '/api/itineraries', '/api/routes', '/api/history', '/api/flights', '/%61pi/health', '/.env']) {
    const response = await worker.fetch(req(path), env);
    assert.ok([303, 401].includes(response.status), path);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  }
  assert.equal(env.state(), undefined, 'anonymous requests do not access Durable Object or providers');
});
test('missing secrets, storage or edge limiter fails closed', async () => {
  for (const name of ['SESSION_SECRET', 'PASSWORD_VERIFIER', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET', 'ACCESS_GUARD', 'EDGE_LIMITER', 'LOGIN_LIMITER', 'HUMAN_LIMITER']) {
    const env = environment();delete env[name];
    assert.equal((await worker.fetch(req('/'), env)).status, 503);
  }
});
test('production never accepts Cloudflare testing keys', async () => {
  for (const name of ['TURNSTILE_SITE_KEY','TURNSTILE_SECRET']) {
    const env=environment();env[name]='1x00000000000000000000AA';
    assert.equal((await worker.fetch(req('/auth/login'),env)).status,503);
  }
});
test('login stores secure cookie; protected page and API open; cookie is never localStorage', async () => {
  const env = environment(), response = await attempt(env);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/');
  const session = response.headers.getSetCookie().find(v => v.startsWith('__Host-tteum-session='));
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) assert.ok(session.includes(flag));
  const headers = {Cookie: session.split(';')[0]};
  assert.equal((await worker.fetch(req('/', {headers}), env)).status, 200);
  assert.equal((await worker.fetch(req('/api/health', {headers}), env)).status, 200);
  const page = await (await worker.fetch(req('/auth/login'), env)).text();
  assert.ok(!page.includes(password));assert.ok(!page.includes(secret));assert.ok(!page.includes(verifier));
});
test('password guessing is limited globally across independent requests; success cannot bypass cooldown', async () => {
  const env = environment();
  for (let i = 0; i < LIMITS.loginIp; i++) assert.equal((await attempt(env, 'wrong', {}, '/', 'human-ok')).status, 401);
  const response = await attempt(env, password, {}, '/', 'human-ok');
  assert.equal(response.status, 429);assert.ok(Number(response.headers.get('Retry-After')) > 0);
});
test('unverified clients get a smaller budget and cannot spend the verified owner allowance', async () => {
  const env = environment();
  for (let i = 0; i < LIMITS.botLoginIp; i++) assert.equal((await attempt(env, 'wrong')).status, 401);
  const blocked = await attempt(env);
  assert.equal(blocked.status, 403);
  assert.match(await blocked.text(), /data-appearance="always"/);
  assert.equal(env.state().counts['login-global'].count, LIMITS.botLoginIp, 'blocked bot attempts are not counted');
  assert.equal((await attempt(env, password, {}, '/', 'human-ok')).status, 303);
});
test('bots across many addresses cannot lock out a verified owner', () => {
  const state = {}, now = 1000000;
  for (let i = 0; i < LIMITS.botLoginGlobal; i++) {
    assert.ok(transition(state, {action: 'login', ip: `bot${i}`}, now).ok);
    transition(state,{action:'failed-login',ip:`bot${i}`},now);
  }
  for (let i = 0; i < 50; i++) assert.equal(transition(state, {action: 'login', ip: `more${i}`}, now).status, 428);
  assert.equal(state.counts['login-global'].count, LIMITS.botLoginGlobal);
  assert.ok(transition(state, {action: 'login', ip: 'owner', human: true}, now).ok);
  state.counts['login-global'].count = LIMITS.loginGlobal;
  const closed = transition(state, {action: 'login', ip: 'bot', human: false}, now);
  assert.equal(closed.status, 429);assert.ok(!closed.needsHuman, 'no false promise when even people are limited');
});
test('successful logins never consume the wrong-password challenge budget', async () => {
  const env=environment();
  for(let i=0;i<5;i++)assert.equal((await attempt(env)).status,303);
  assert.equal(env.state().counts['failed-global'],undefined);
  assert.equal(env.state().counts['login-global'].count,5,'CPU and login request limits still apply');
});
test('forged, foreign or unverifiable human tokens are rejected without spending login budget', async () => {
  const env = environment();
  for (const token of ['human-bad', 'other-site', 'x'.repeat(2049)]) {
    const response = await attempt(env, password, {}, '/', token);
    assert.equal(response.status, 403, token.slice(0, 12));
  }
  assert.equal(env.state(), undefined, 'rejected tokens never reach durable state');
  assert.equal([...env.humanChecks.values()][0], 2);
  const call = siteverify.find(x => x.response === 'human-bad');
  assert.equal(call.secret, '0x4AAAAAAAsecret');assert.ok(call.idempotency_key);
});
test('login page loads the human check only from Cloudflare with a nonce', async () => {
  const response = await worker.fetch(req('/auth/login'), environment()), csp = response.headers.get('Content-Security-Policy'), body = await response.text();
  assert.match(csp, /script-src 'nonce-[\w-]+' https:\/\/challenges\.cloudflare\.com;/);
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com;/);
  assert.match(body, /data-sitekey="0x4AAAAAAAtest"/);assert.match(body, /data-appearance="interaction-only"/);
  assert.ok(!body.includes('0x4AAAAAAAsecret'));
});
test('Cloudflare outage falls back to the bot budget instead of locking the owner out', async () => {
  assert.equal((await attempt(environment(), password, {}, '/', 'offline')).status, 303);
});
test('bogus bot checks cannot create unlimited external validation requests or stored state', async () => {
  const env=environment();
  for(let i=0;i<10;i++)assert.equal((await attempt(env,'wrong',{},'/','human-bad')).status,403);
  const before=siteverify.length;
  const response=await attempt(env,password,{},'/','human-bad');
  assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');
  assert.equal(siteverify.length,before);
  assert.equal(env.state(),undefined);
});
test('junk tokens from many addresses never block a verified owner', async () => {
  const env=environment();
  for(let i=0;i<600;i++)await attempt(env,'wrong',{'CF-Connecting-IP':`198.51.${i>>8}.${i&255}`},'/','human-bad');
  assert.equal((await attempt(env,password,{'CF-Connecting-IP':'203.0.113.9'},'/','human-ok')).status,303);
});
test('a browser that logged in before keeps its own budget when everyone else is limited', async () => {
  const env=environment(), first=await attempt(env,password,{},'/','human-ok');
  const device=cookieOf(first,'__Host-tteum-device');
  const flags=first.headers.getSetCookie().find(v=>v.startsWith('__Host-tteum-device='));
  for(const flag of ['Secure','HttpOnly','SameSite=Strict','Max-Age=7776000'])assert.ok(flags.includes(flag));
  env.state().counts['login-global']={count:LIMITS.loginGlobal,until:Date.now()+900000};
  assert.equal((await attempt(env,password,{},'/','human-ok')).status,429,'others are limited');
  const calls=siteverify.length;
  const again=await attempt(env,password,{},'/','',device);
  assert.equal(again.status,303);assert.equal(siteverify.length,calls,'known browser skips the external check');
  assert.equal(cookieOf(again,'__Host-tteum-device'),undefined,'device token is not reissued');
  for(let i=0;i<LIMITS.deviceLogin-1;i++)await attempt(env,'wrong',{},'/','',device);
  assert.equal((await attempt(env,password,{},'/','',device)).status,429,'a stolen device token still cannot guess freely');
  const forged='__Host-tteum-device='+await sign(secret,{type:'device',id:random(),iat:Date.now(),exp:Date.now()+1000,aud:'https://evil.test'});
  assert.equal((await attempt(env,password,{},'/','',forged)).status,429,'foreign device token gets no bypass');
});
test('IPv6 addresses are limited per /64 network', () => {
  assert.equal(clientNetwork('2001:db8:1:2::1'),clientNetwork('2001:db8:1:2:ffff:ffff:ffff:ffff'));
  assert.equal(clientNetwork('2001:0db8:0001:0002:0:0:0:1'),'2001:db8:1:2::/64');
  assert.notEqual(clientNetwork('2001:db8:1:2::1'),clientNetwork('2001:db8:1:3::1'));
  assert.equal(clientNetwork('203.0.113.9'),'203.0.113.9');assert.equal(clientNetwork(''),'unknown');
});
test('login CSRF, duplicate fields, oversized input, bad types and cross-origin writes rejected', async () => {
  const env = environment();
  assert.equal((await attempt(env, password, {Origin: 'https://evil.test'})).status, 403);
  assert.equal((await attempt(env, password, {'Sec-Fetch-Site': 'same-site'})).status, 403);
  for (const body of ['password=x&csrf=wrong', 'password=x&password=y', 'x'.repeat(3000)]) {
    const response = await worker.fetch(req('/auth/login', {method:'POST', headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body}), env);
    assert.ok([400, 403].includes(response.status));
  }
  assert.equal(env.state(), undefined);
});
test('logout invalidates copied session server-side; foreign origin cannot logout', async () => {
  const env = environment(), cookie = await login(env), headers = {Cookie:cookie};
  assert.equal((await worker.fetch(req('/auth/logout', {method:'POST',headers:{...headers,Origin:'https://evil.test'}}), env)).status, 403);
  assert.equal((await worker.fetch(req('/auth/logout', {method:'POST',headers:{...headers,Origin:base}}), env)).status, 303);
  assert.equal((await worker.fetch(req('/api/health', {headers}), env)).status, 401);
  assert.equal((await worker.fetch(req('/', {headers}), env)).status, 303);
});
test('tampered, expired, wrong audience and duplicate session cookies do not authenticate', async () => {
  const env = environment(), cookie = await login(env);
  const payload = {type:'session',id:random(),iat:Date.now()-5000,exp:Date.now()-100,aud:base};
  for (const value of [cookie + 'x', cookie + '; ' + cookie, '__Host-tteum-session=' + await sign(secret,payload), '__Host-tteum-session=' + await sign(secret,{...payload,exp:Date.now()+10000,aud:'https://evil.test'})])
    assert.equal((await worker.fetch(req('/api/health',{headers:{Cookie:value}}),env)).status,401);
});
test('open redirects are prevented without losing valid deep links', async () => {
  for (const value of ['//evil.test','/\\evil.test','https://evil.test','/auth/login','/\r\nLocation: x']) assert.equal(safeNext(value),'/');
  assert.equal(safeNext('/?month=11#planner'),'/?month=11#planner');
  assert.equal((await attempt(environment(),password,{},'//evil.test')).headers.get('Location'),'/');
});
test('API request budget enforced concurrently, guard failure denies all protected requests', async () => {
  const env = environment(), cookie = await login(env);
  const responses = await Promise.all(Array.from({length:35},()=>worker.fetch(req('/api/health',{headers:{Cookie:cookie}}),env)));
  assert.equal(responses.filter(r=>r.status===200).length,LIMITS.apiSession);
  assert.equal(responses.filter(r=>r.status===429).length,5);
  env.ACCESS_GUARD.get=()=>({fetch:async()=>{throw new Error('offline');}});
  assert.equal((await worker.fetch(req('/',{headers:{Cookie:cookie}}),env)).status,503);
});
test('actual upstream calls have shared daily budget, bounded concurrency and expiring leases', () => {
  const state = {}, now = 1000000;
  transition(state,{action:'create',id:'a',exp:now+100000},now);
  transition(state,{action:'create',id:'b',exp:now+100000},now);
  for(let i=0;i<LIMITS.upstreamConcurrent;i++) assert.ok(transition(state,{action:'upstream',id:i%2?'a':'b',lease:String(i)},now).ok);
  assert.equal(transition(state,{action:'upstream',id:'a',lease:'full'},now).status,429);
  assert.ok(transition(state,{action:'upstream',id:'b',lease:'expired'},now+26000).ok);
  state.counts['up-day']={count:LIMITS.upstreamDay,until:now+86400000};
  assert.equal(transition(state,{action:'upstream',id:'a',lease:'cap'},now+26000).status,429);
});
test('upstream SSRF denied; global limit never makes a network call; lease released on failure', async () => {
  const env=environment();await login(env);const id=Object.keys(env.state().sessions)[0];let calls=0;
  const fetcher=protectedFetcher(env,{id},async()=>{calls++;throw new Error('upstream unavailable');});
  await assert.rejects(fetcher('https://evil.test'),/허용하지/);assert.equal(calls,0);
  await assert.rejects(fetcher('https://www.google.com/travel/flights'),/unavailable/);
  assert.equal(Object.keys(env.state().leases).length,0);
  env.ACCESS_GUARD.get=()=>({fetch:async()=>Response.json({ok:false,status:429,retryAfter:60})});
  await assert.rejects(fetcher('https://api.catchfrog.ai/api/v1'),/한도/);assert.equal(calls,1);
});
