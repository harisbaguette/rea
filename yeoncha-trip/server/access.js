import {checkPassword, mac, random, sign, verify} from './access-crypto.js';
import {guard, LIMITS} from './access-guard.js';
import {loginPage} from './access-page.js';
import {FlightError} from './flights.js';

const SESSION = '__Host-tteum-session', CSRF = '__Host-tteum-csrf', DEVICE = '__Host-tteum-device';
// IPv6 hosts usually own a whole /64, so per-address limits count the network, not each address.
export function clientNetwork(address = '') {
  if (!address.includes(':')) return address || 'unknown';
  const [head, tail = ''] = address.toLowerCase().split('::');
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  const groups = address.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return `${groups.slice(0, 4).map(g => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
const cookie = (name, value, maxAge) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
function cookies(request) {
  const list = (request.headers.get('Cookie') || '').split(';').map(v => v.trim().split('='));
  return name => {const matches = list.filter(([key]) => key === name); return matches.length === 1 ? matches[0][1] : null;};
}
export function safeNext(value = '/') {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value) || value.length > 2048) return '/';
  try {const url = new URL(value, 'https://local.invalid');return url.origin === 'https://local.invalid' && !url.pathname.startsWith('/auth/') ? url.pathname + url.search + url.hash : '/';} catch {return '/';}
}
export function securityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(response.body, {status: response.status, headers});
}
const error = (status, code, message, retryAfter = 0) => new Response(JSON.stringify({error: {code, message}}), {status, headers: {'Content-Type': 'application/json; charset=utf-8', ...(retryAfter ? {'Retry-After': String(retryAfter)} : {})}});
const redirect = (path, headers = {}) => new Response(null, {status: 303, headers: {Location: path, ...headers}});
const audit = (result, extra = {}) => console.log(JSON.stringify({event: 'auth', result, ...extra}));
// No token, or Cloudflare being unreachable, falls back to the smaller bot budget;
// a token Cloudflare rejects is refused outright.
async function verifyHuman(env, token, ip, key, hostname) {
  if (!token) return false;
  if (token.length > 2048) return null;
  // Edge limiter instead of stored state: junk tokens from many addresses cannot fill a shared table.
  if (!(await env.HUMAN_LIMITER.limit({key})).success) return {retryAfter: 60};
  let result;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', signal: AbortSignal.timeout(5000),
      body: new URLSearchParams({secret: env.TURNSTILE_SECRET, response: token, ...(ip ? {remoteip: ip} : {}), idempotency_key: crypto.randomUUID()}),
    });
    if (!response.ok) return false;
    result = await response.json();
  } catch {return false;}
  // Testing keys answer for example.com. Only the local test secret (1x…) gets that answer;
  // wrangler dev rewrites the request host, so the host cannot identify local runs.
  const localTest = env.TURNSTILE_SECRET.startsWith('1x0000') && result?.metadata?.result_with_testing_key === true;
  return result?.success === true && (localTest || (result.hostname === hostname && result.action === 'login')) ? true : null;
}
const sameOrigin = request => request.headers.get('Origin') === new URL(request.url).origin && !['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'));
async function readBody(request) {
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new Error('BAD_BODY');
  if (Number(request.headers.get('Content-Length')) > 8192) throw new Error('BAD_BODY');
  const reader = request.body?.getReader(); if (!reader) throw new Error('BAD_BODY');
  let size = 0, body = '', timer;
  const deadline = new Promise((_, reject) => {timer = setTimeout(() => {reader.cancel().catch(() => {});reject(new Error('BAD_BODY'));}, 5000);});
  try {
    const decoder = new TextDecoder();
    await Promise.race([deadline, (async () => {while (true) {const {done, value} = await reader.read();if (done) break;size += value.byteLength;if (size > 8192) throw new Error('BAD_BODY');body += decoder.decode(value, {stream: true});}body += decoder.decode();})()]);
    return new URLSearchParams(body);
  } finally {clearTimeout(timer); await reader.cancel().catch(() => {});}
}

export async function authorize(request, env, assets) {
  const url = new URL(request.url), getCookie = cookies(request);
  if (!env?.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.PASSWORD_VERIFIER || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET || !env.ACCESS_GUARD || !env.EDGE_LIMITER || !env.LOGIN_LIMITER || !env.HUMAN_LIMITER)
    return {response: error(503, 'ACCESS_UNAVAILABLE', '접속 준비 중입니다. 잠시 후 다시 시도해 주세요.')};
  if (url.hostname === 'air.bluekite.co.kr' && (/^[123]x/.test(env.TURNSTILE_SITE_KEY) || /^[123]x/.test(env.TURNSTILE_SECRET)))
    return {response: error(503, 'ACCESS_UNAVAILABLE', '접속 설정을 확인하고 있습니다.')};
  const ip = await mac(env.SESSION_SECRET, `${new Date().toISOString().slice(0, 10)}:${clientNetwork(request.headers.get('CF-Connecting-IP') || '')}`);
  if (!(await env.EDGE_LIMITER.limit({key: ip})).success) return {response: error(429, 'RATE_LIMITED', '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.', 60)};
  if (url.href.length > 4096 || (request.headers.get('Cookie') || '').length > 4096) return {response: error(400, 'INVALID_REQUEST', '요청을 확인해 주세요.')};
  if (url.pathname === '/robots.txt') return {response: new Response('User-agent: *\nDisallow: /\n', {headers: {'Content-Type': 'text/plain'}})};
  const session = await verify(env.SESSION_SECRET, getCookie(SESSION), 'session', url.origin);
  const alive = async () => session && (await guard(env, {action: 'session', id: session.id})).ok;
  if (url.pathname === '/auth/login') {
    const page = async (status = 200, message = '', retryAfter = 0, next = safeNext(url.searchParams.get('next') || '/'), challenge = false) => {
      const csrf = await sign(env.SESSION_SECRET, {type: 'csrf', id: random(), iat: Date.now(), exp: Date.now() + 1200000, aud: url.origin});
      const nonce = random();
      return {response: new Response(loginPage({csrf, next, nonce, assets, message, retryAfter, siteKey: env.TURNSTILE_SITE_KEY, challenge}), {status, headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie(CSRF, csrf, 1200),
        'Content-Security-Policy': `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
        ...(retryAfter ? {'Retry-After': String(retryAfter)} : {}),
      }})};
    };
    if (request.method === 'GET') return await alive() ? {response: redirect(safeNext(url.searchParams.get('next') || '/'))} : page();
    if (request.method !== 'POST') return {response: error(405, 'METHOD_NOT_ALLOWED', '허용하지 않는 요청입니다.')};
    if (!sameOrigin(request)) return {response: error(403, 'ORIGIN_DENIED', '이 사이트에서 다시 입장해 주세요.')};
    if (!(await env.LOGIN_LIMITER.limit({key: ip})).success) return page(429, '시도가 너무 잦아요. 잠시 후 다시 시도해 주세요.', 60);
    let form;
    try {form = await readBody(request);} catch {return page(400, '입력 내용을 다시 확인해 주세요.');}
    const next = safeNext(form.get('next') || '/'), csrf = form.get('csrf');
    if ([...form.keys()].some(k => !['password', 'csrf', 'next', 'cf-turnstile-response'].includes(k) || form.getAll(k).length !== 1) || !csrf || csrf !== getCookie(CSRF) || !await verify(env.SESSION_SECRET, csrf, 'csrf', url.origin)) return page(403, '입장 시간이 지났어요. 다시 입력해 주세요.', 0, next);
    const password = form.get('password');
    if (!password || password.length > 128) return page(400, '비밀번호를 입력해 주세요.', 0, next);
    const device = await verify(env.SESSION_SECRET, getCookie(DEVICE), 'device', url.origin);
    const human = device ? false : await verifyHuman(env, form.get('cf-turnstile-response'), request.headers.get('CF-Connecting-IP'), ip, url.hostname);
    if (human && typeof human === 'object') {audit('human-limited'); return page(429, '시도가 너무 잦아요. 잠시 후 다시 시도해 주세요.', human.retryAfter, next);}
    if (human === null) {audit('human-failed'); return page(403, '자동 입력 방지 확인을 다시 마친 뒤 입장해 주세요.', 0, next, true);}
    const permitted = await guard(env, {action: 'login', ip, human, device: device?.id});
    if (permitted.needsHuman) {audit('human-required'); return page(403, '시도가 많아 확인이 필요해요. 아래 확인을 마친 뒤 입장해 주세요.', 0, next, true);}
    if (!permitted.ok) {audit('limited', {human}); return page(429, '시도가 너무 잦아요. 잠시 후 다시 시도해 주세요.', permitted.retryAfter, next);}
    if (!await checkPassword(password, env.SESSION_SECRET, env.PASSWORD_VERIFIER)) {
      if (!device) await guard(env, {action: 'failed-login', ip});
      audit('wrong-password', {human, device: !!device}); return page(401, '비밀번호가 맞지 않아요.', 0, next, !human && !device);
    }
    const payload = {type: 'session', id: random(), iat: Date.now(), exp: Date.now() + LIMITS.sessionSeconds * 1000, aud: url.origin};
    const created = await guard(env, {action: 'create', id: payload.id, exp: payload.exp, ip});
    if (!created.ok) return page(429, '접속이 잠시 몰렸어요. 잠시 후 다시 시도해 주세요.', created.retryAfter, next);
    audit('login', {human, device: !!device});
    const response = redirect(next);
    const known = device || {type: 'device', id: random(), iat: Date.now(), exp: Date.now() + LIMITS.deviceSeconds * 1000, aud: url.origin};
    if (!device) response.headers.append('Set-Cookie', cookie(DEVICE, await sign(env.SESSION_SECRET, known), LIMITS.deviceSeconds));
    response.headers.append('Set-Cookie', cookie(SESSION, await sign(env.SESSION_SECRET, payload), LIMITS.sessionSeconds));
    response.headers.append('Set-Cookie', cookie(CSRF, '', 0));
    return {response};
  }
  if (url.pathname === '/auth/logout') {
    if (request.method !== 'POST') return {response: error(405, 'METHOD_NOT_ALLOWED', '허용하지 않는 요청입니다.')};
    if (!sameOrigin(request)) return {response: error(403, 'ORIGIN_DENIED', '이 사이트에서 다시 시도해 주세요.')};
    if (session) await guard(env, {action: 'logout', id: session.id});
    const response = redirect('/auth/login', {'Clear-Site-Data': '"cache"'});
    response.headers.append('Set-Cookie', cookie(SESSION, '', 0));
    response.headers.append('Set-Cookie', cookie(CSRF, '', 0));
    return {response};
  }
  if (!session) return {response: unauthenticated(request)};
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin)) return {response: error(403, 'ORIGIN_DENIED', '이 사이트에서 직접 조회해 주세요.')};
  const permitted = await guard(env, {action: url.pathname.startsWith('/api/') ? 'api' : 'session', id: session.id});
  if (!permitted.ok) return {response: permitted.status === 401 ? unauthenticated(request) : error(429, 'RATE_LIMITED', '조회가 너무 잦아요. 잠시 후 다시 시도해 주세요.', permitted.retryAfter)};
  return {session};
}

function unauthenticated(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/book') return error(401, 'AUTH_REQUIRED', '비밀번호로 다시 입장해 주세요.');
  return redirect(`/auth/login?next=${encodeURIComponent(safeNext(url.pathname + url.search))}`);
}

// Count every actual external call, including cache misses inside an overview.
export function protectedFetcher(env, session, fetcher = fetch) {
  let calls = 0;
  return async (url, init = {}) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !['api.catchfrog.ai', 'www.google.com'].includes(target.hostname) || target.port || target.username || target.password) throw new FlightError(403, 'SOURCE_DENIED', '허용하지 않는 조회 주소입니다.');
    if (++calls > 80) throw new FlightError(429, 'RESOURCE_LIMIT', '한 번에 조회할 수 있는 범위를 넘었어요.', 60);
    const lease = random(), permission = await guard(env, {action: 'upstream', id: session.id, lease});
    if (!permission.ok) throw new FlightError(permission.status, 'RESOURCE_LIMIT', '조회 한도에 도달했어요. 잠시 후 다시 시도해 주세요.', permission.retryAfter);
    try {
      const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000);
      const response = await fetcher(url, {...init, signal, redirect: 'manual'});
      const reader = response.body?.getReader(); let size = 0; const chunks = [];
      if (reader) try {while (true) {const {done, value} = await reader.read();if (done) break;size += value.byteLength;if (size > 6 * 1024 * 1024) throw new Error('SOURCE_TOO_LARGE');chunks.push(value);}} finally {await reader.cancel().catch(() => {});}
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) {bytes.set(chunk, offset);offset += chunk.byteLength;}
      return new Response(response.body ? bytes : null, {status: response.status, statusText: response.statusText, headers: response.headers});
    } finally {await guard(env, {action: 'release', lease}).catch(() => {});}
  };
}
