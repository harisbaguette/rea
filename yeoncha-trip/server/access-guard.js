// One SQLite-backed Durable Object enforces limits across every Worker isolate.
// Only the owning Worker can call it; no public route reaches this class.
export const LIMITS = Object.freeze({
  // Repeated wrong passwords require Turnstile; successful entries do not
  // consume the failure budget. Every attempt still has a hard rate limit.
  loginIp: 8, loginGlobal: 80, loginWindow: 900, botLoginIp: 4, botLoginGlobal: 20,
  apiSession: 30, apiGlobalMinute: 120, apiGlobalDay: 3000,
  upstreamMinute: 120, upstreamHour: 1200, upstreamDay: 5000,
  upstreamConcurrent: 6, sessionSeconds: 28800,
  // A browser that has logged in before keeps its own budget, so even solved
  // challenges bought by an attacker cannot use up the owner's way in.
  deviceLogin: 8, deviceSeconds: 7776000,
});

function take(state, rules, now, consume = true) {
  for (const [key, limit, seconds] of rules) {
    const row = state.counts[key];
    if (row && row.until > now && row.count >= limit)
      return {ok: false, status: 429, retryAfter: Math.max(1, Math.ceil((row.until - now) / 1000))};
  }
  if (!consume) return {ok: true};
  for (const [key, , seconds] of rules) {
    const row = state.counts[key];
    if (!row || row.until <= now) state.counts[key] = {count: 1, until: now + seconds * 1000};
    else row.count++;
  }
  return {ok: true};
}

// Pure transition is also used by deterministic concurrency/expiry tests.
export function transition(state, input, now = Date.now()) {
  state.counts ||= {}; state.sessions ||= {}; state.leases ||= {};
  for (const [key, row] of Object.entries(state.counts)) if (row.until <= now) delete state.counts[key];
  for (const [key, until] of Object.entries(state.sessions)) if (until <= now) delete state.sessions[key];
  for (const [key, until] of Object.entries(state.leases)) if (until <= now) delete state.leases[key];
  if (input.action === 'login' && input.device) return take(state, [[`device:${input.device}`, LIMITS.deviceLogin, LIMITS.loginWindow]], now);
  if (input.action === 'login') {
    const hard = [['login-global', LIMITS.loginGlobal, LIMITS.loginWindow], [`login:${input.ip}`, LIMITS.loginIp, LIMITS.loginWindow]];
    const available = take(state, hard, now, false);
    if (!available.ok) return available;
    if (input.human !== true) {
      const failures = take(state, [['failed-global', LIMITS.botLoginGlobal, LIMITS.loginWindow], [`failed:${input.ip}`, LIMITS.botLoginIp, LIMITS.loginWindow]], now, false);
      if (!failures.ok) return {ok: false, status: 428, needsHuman: true, retryAfter: failures.retryAfter};
    }
    return take(state, hard, now);
  }
  if (input.action === 'failed-login') {
    return take(state, [['failed-global', Number.MAX_SAFE_INTEGER, LIMITS.loginWindow], [`failed:${input.ip}`, Number.MAX_SAFE_INTEGER, LIMITS.loginWindow]], now);
  }
  if (input.action === 'create') {
    if (Object.keys(state.sessions).length >= 200) return {ok: false, status: 429, retryAfter: 900};
    state.sessions[input.id] = Math.min(input.exp, now + LIMITS.sessionSeconds * 1000);
    if (input.ip) delete state.counts[`failed:${input.ip}`];
    return {ok: true};
  }
  if (input.action === 'logout') {delete state.sessions[input.id]; return {ok: true};}
  if (input.action === 'release') {delete state.leases[input.lease]; return {ok: true};}
  if (!state.sessions[input.id]) return {ok: false, status: 401};
  if (input.action === 'session') return {ok: true};
  if (input.action === 'api') return take(state, [
    [`api:${input.id}`, LIMITS.apiSession, 60],
    ['api-minute', LIMITS.apiGlobalMinute, 60],
    ['api-day', LIMITS.apiGlobalDay, 86400],
  ], now);
  if (input.action === 'upstream') {
    if (Object.keys(state.leases).length >= LIMITS.upstreamConcurrent) return {ok: false, status: 429, retryAfter: 5};
    const result = take(state, [
      ['up-minute', LIMITS.upstreamMinute, 60],
      ['up-hour', LIMITS.upstreamHour, 3600],
      ['up-day', LIMITS.upstreamDay, 86400],
    ], now);
    if (result.ok) state.leases[input.lease] = now + 25000;
    return result;
  }
  return {ok: false, status: 400};
}

export class AccessGuard {
  constructor(ctx) {this.ctx = ctx;}
  async fetch(request) {
    const input = await request.json();
    const result = await this.ctx.storage.transaction(async storage => {
      const state = await storage.get('guard') || {};
      const result = transition(state, input);
      await storage.put('guard', state);
      return result;
    });
    return Response.json(result);
  }
}

export async function guard(env, input) {
  const stub = env.ACCESS_GUARD.get(env.ACCESS_GUARD.idFromName('private-site-v1'));
  const response = await stub.fetch('https://guard.internal/', {
    method: 'POST', body: JSON.stringify(input), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('GUARD_UNAVAILABLE');
  return response.json();
}
