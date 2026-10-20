// 로그인 세션 (db/보안_개인정보_명세.md 2·6)
// 브라우저에는 HttpOnly 세션 쿠키만. 하루 미사용이면 끝, 계속 써도 30일이면 다시 로그인
import crypto from 'node:crypto';
import { getDb, type Db } from './db.js';
import { HttpError, appOrigin, clearCookie, cookie, readCookies } from './http.js';

export const SESSION_COOKIE = 'gk_session';
export const CSRF_COOKIE = 'gk_csrf'; // 화면이 읽어 X-CSRF-Token으로 돌려보냄
export const IDLE_MS = 24 * 3600 * 1000;
const ABSOLUTE_MS = 30 * 24 * 3600 * 1000;
const TOUCH_MS = 60 * 1000; // 마지막 요청 시각은 1분에 한 번만 기록
const REAUTH_MS = 60 * 60 * 1000; // 되돌릴 수 없는 작업은 로그인 1시간 안에만

// 약관·처리방침 문안을 바꾸면 버전을 올림 → 다음 로그인 때 다시 받음
export const CONSENT_VERSION = '2026-10-18';
export const CONSENT_TYPES = ['age', 'terms', 'privacy'] as const;

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
export const csrfFor = (t: string) => crypto.createHash('sha256').update('csrf:' + t).digest('base64url');
const iso = (ms: number) => new Date(ms).toISOString();

export interface User { id: string; email: string; display_name: string }
export interface Session { user: User; consented: boolean; loginAt: number; idleExpiresAt: number }

export async function createSession(userId: string, db?: Db): Promise<string[]> {
  db ??= await getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run(
    'INSERT INTO auth_sessions (id, user_id, created_at, last_seen_at, idle_expires_at, absolute_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    hash(token), userId, iso(now), iso(now), iso(now + IDLE_MS), iso(now + ABSOLUTE_MS),
  );
  const age = ABSOLUTE_MS / 1000;
  return [cookie(SESSION_COOKIE, token, age), cookie(CSRF_COOKIE, csrfFor(token), age, false)];
}

export async function endSession(req: Request, reason: string): Promise<void> {
  const t = readCookies(req)[SESSION_COOKIE];
  if (t) await (await getDb()).run('UPDATE auth_sessions SET ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL', iso(Date.now()), reason, hash(t));
}
export const clearSession = () => [clearCookie(SESSION_COOKIE), clearCookie(CSRF_COOKIE)];

export async function hasConsent(userId: string, db: Db): Promise<boolean> {
  const r = await db.get<{ n: number }>(
    `SELECT COUNT(*) n FROM user_consents WHERE user_id = ? AND version = ? AND agreed = 1 AND type IN (${CONSENT_TYPES.map(() => '?').join(',')})`,
    userId, CONSENT_VERSION, ...CONSENT_TYPES,
  );
  return r?.n === CONSENT_TYPES.length;
}

/** 이 요청의 세션. 끝났으면 { reason } (idle: 하루 미사용 / expired: 30일) */
export async function getSession(req: Request): Promise<Session | { user: null; reason: 'idle' | 'expired' | null }> {
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token) return { user: null, reason: null };
  const db = await getDb();
  const row = await db.get<User & { s_created: string; s_idle: string; s_abs: string; s_seen: string; s_ended: string | null }>(
    `SELECT u.id, u.email, u.display_name, s.created_at s_created, s.idle_expires_at s_idle, s.absolute_expires_at s_abs, s.last_seen_at s_seen, s.ended_at s_ended
     FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    hash(token),
  );
  if (!row || row.s_ended) return { user: null, reason: null };
  const now = Date.now();
  const idleAt = Date.parse(row.s_idle);
  if (Date.parse(row.s_abs) <= now || idleAt <= now) {
    const reason = idleAt <= now ? 'idle' : 'expired';
    await db.run('UPDATE auth_sessions SET ended_at = ?, end_reason = ? WHERE id = ?', iso(now), reason === 'idle' ? 'idle' : 'absolute', hash(token));
    if (reason === 'idle') await logAccess(req, 'idle_logout', row.id, db);
    return { user: null, reason };
  }
  // 요청이 올 때마다 하루 연장 (1분에 한 번만 기록)
  let idleExpiresAt = idleAt;
  if (now - Date.parse(row.s_seen) > TOUCH_MS) {
    idleExpiresAt = now + IDLE_MS;
    await db.run('UPDATE auth_sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?', iso(now), iso(idleExpiresAt), hash(token));
  }
  return {
    user: { id: row.id, email: row.email, display_name: row.display_name },
    consented: await hasConsent(row.id, db),
    loginAt: Date.parse(row.s_created),
    idleExpiresAt: Math.min(idleExpiresAt, Date.parse(row.s_abs)),
  };
}

// 같은 사이트의 화면에서 보낸 요청인지 (Origin 머리글)
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  return !!origin && (origin === appOrigin(req) || origin === new URL(req.url).origin);
}

// 상태를 바꾸는 요청: 같은 사이트에서 왔고, CSRF 토큰이 세션과 맞아야 함
export function checkCsrf(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.get('origin');
  if (origin && origin !== appOrigin(req) && origin !== new URL(req.url).origin) return false;
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token) return !!origin; // 세션이 없을 때(가입 동의)는 Origin으로만 확인
  const sent = req.headers.get('x-csrf-token') || '';
  const want = csrfFor(token);
  return sent.length === want.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(want));
}

// API 공통: 로그인·동의를 마친 사용자. 아니면 401/403
export async function requireUser(req: Request): Promise<Session> {
  if (!checkCsrf(req)) throw new HttpError(403, 'csrf');
  const s = await getSession(req);
  if (!s.user) throw new HttpError(401, s.reason || 'unauthorized');
  if (!(s as Session).consented) throw new HttpError(403, 'consent');
  return s as Session;
}

export function requireRecentLogin(s: Session) {
  if (Date.now() - s.loginAt > REAUTH_MS) throw new HttpError(403, 'reauth');
}

// ── 접속 기록: 이메일 등은 남기지 않음, IP 뒷부분 가림, 3개월 뒤 삭제 ──
export function maskIp(ip: string) {
  if (!ip) return 'unknown';
  if (ip.includes('.')) return ip.split('.').slice(0, 2).join('.') + '.*.*';
  return ip.split(':').slice(0, 3).join(':') + ':*';
}
export function clientOf(ua: string | null) {
  if (!ua) return null;
  const b = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const o = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return b + ' / ' + o;
}
export async function logAccess(req: Request, event: string, userId: string | null, db?: Db) {
  db ??= await getDb();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  await db.run('INSERT INTO access_logs (user_id, event, ip_masked, client) VALUES (?, ?, ?, ?)', userId, event, maskIp(ip), clientOf(req.headers.get('user-agent')));
}
export async function purgeOldLogs() {
  await (await getDb()).run("DELETE FROM access_logs WHERE at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days')");
}
