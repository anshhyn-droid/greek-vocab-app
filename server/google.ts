// Google 로그인 (db/보안_개인정보_명세.md 6-2): state + PKCE, ID 토큰의 서명·aud·iss·exp를 서버에서 확인
import crypto from 'node:crypto';

export const PENDING_COOKIE = 'gk_signup'; // 동의 전 새 사용자의 Google 정보 (암호화, 10분)
export const PENDING_SEC = 600;
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const b64url = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString('base64url');

export function newPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}

interface Jwk { kid: string; [k: string]: unknown }
let jwks: { keys: Jwk[]; until: number } = { keys: [], until: 0 };
async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && Date.now() < jwks.until) return jwks.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('jwks ' + res.status);
  const age = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1]) || 3600;
  jwks = { keys: ((await res.json()) as { keys: Jwk[] }).keys, until: Date.now() + age * 1000 };
  return jwks.keys;
}

export interface GoogleClaims { sub: string; email: string; name?: string; email_verified?: boolean }

export async function verifyIdToken(idToken: string): Promise<GoogleClaims> {
  const [h, p, sig] = String(idToken || '').split('.');
  if (!h || !p || !sig) throw new Error('id_token shape');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  if (header.alg !== 'RS256') throw new Error('id_token alg');
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('id_token kid');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' }), Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('id_token signature');
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (c.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('id_token aud');
  if (!ISSUERS.includes(c.iss)) throw new Error('id_token iss');
  if (!(c.exp > Date.now() / 1000)) throw new Error('id_token exp');
  if (!c.sub || !c.email || c.email_verified === false) throw new Error('id_token claims');
  return c;
}

// 동의 전 정보: AES-256-GCM (열쇠는 서버 비밀값에서). 브라우저는 읽거나 바꿀 수 없음
const key = () => crypto.createHash('sha256').update('gk-signup:' + (process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || '')).digest();

export function sealPending({ sub, email, name }: GoogleClaims): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify({ sub, email, name, exp: Date.now() + PENDING_SEC * 1000 })), c.final()]);
  return b64url(Buffer.concat([iv, c.getAuthTag(), data]));
}

export function openPending(value: string | undefined): GoogleClaims | null {
  try {
    const raw = Buffer.from(String(value || ''), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const v = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString());
    return v.exp > Date.now() ? v : null;
  } catch {
    return null;
  }
}
