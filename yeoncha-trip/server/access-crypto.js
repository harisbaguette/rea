const encoder = new TextEncoder();
export const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const key = secret => crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
export const random = () => encode(crypto.getRandomValues(new Uint8Array(24)));
export async function mac(secret, value) {return encode(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(value)));}
export async function sign(secret, payload) {
  const data = encode(encoder.encode(JSON.stringify(payload)));
  return `${data}.${await mac(secret, data)}`;
}
export async function verify(secret, token, type, audience, now = Date.now()) {
  try {
    if (!token || token.length > 1024) return null;
    const [data, signature, extra] = token.split('.');
    if (extra || !signature || !await crypto.subtle.verify('HMAC', await key(secret), decode(signature), encoder.encode(data))) return null;
    const value = JSON.parse(new TextDecoder().decode(decode(data)));
    if (value.type !== type || value.aud !== audience || !/^[\w-]{32}$/.test(value.id) || !Number.isFinite(value.exp) || !Number.isFinite(value.iat) || value.exp <= now || value.iat > now + 5000 || value.exp <= value.iat || value.exp - value.iat > ({session: 28800000, device: 7776000000}[type] || 1200000)) return null;
    return value;
  } catch {return null;}
}
async function derive(password, secret, salt) {
  // A separately stored pepper prevents offline guesses from a verifier alone.
  const material = encoder.encode(await mac(secret, `password:${password}`));
  const base = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations: 100000}, base, 256));
}
export async function makeVerifier(password, secret) {
  const salt = random(); return `v1.${salt}.${encode(await derive(password, secret, salt))}`;
}
export async function checkPassword(password, secret, verifier) {
  const [version, salt, hash, extra] = verifier.split('.');
  if (version !== 'v1' || extra || !/^[\w-]{32}$/.test(salt || '') || !/^[\w-]{43}$/.test(hash || '')) throw new Error('INVALID_VERIFIER');
  const actual = await derive(password, secret, salt), expected = decode(hash);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
