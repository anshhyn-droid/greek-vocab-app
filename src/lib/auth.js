import crypto from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { logAccess } from './accessLog';
import { CONSENT_TYPES, CONSENT_VERSION } from './consent';

export const SESSION_COOKIE = 'gk_session';
export const CSRF_COOKIE = 'gk_csrf'; // 화면 스크립트가 읽어 X-CSRF-Token 머리글로 돌려보냄
export const STATE_COOKIE = 'gk_oauth_state';
export const PKCE_COOKIE = 'gk_oauth_pkce';
export const appOrigin = (request) => process.env.APP_URL || new URL(request.url).origin;

// 보안·개인정보 명세 2: 하루 미사용이면 로그아웃, 계속 써도 30일이면 다시 로그인
// SESSION_IDLE_SEC는 확인용 (예: 120 → 2분)
export const IDLE_SEC = Number(process.env.SESSION_IDLE_SEC) || 86400;
const ABSOLUTE_DAYS = 30;
const TOUCH_EVERY_SEC = 60; // 연장 기록은 1분에 한 번만
// 되돌릴 수 없는 작업(기록 초기화·탈퇴)은 로그인한 지 이 시간 안이어야 함
const REAUTH_SEC = 3600;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const csrfFor = (token) => crypto.createHash('sha256').update('csrf:' + token).digest('base64url');
const iso = (ms) => new Date(ms).toISOString();
// datetime('now')(공백, UTC)와 ISO 문자열 둘 다
const parseTime = (s) => Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');

export function cookieOptions(maxAgeSec, httpOnly = true) {
  return {
    httpOnly,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSec,
  };
}

// 응답에 세션·CSRF 쿠키를 붙임 (로그인·동의 직후)
export function setSessionCookies(res, { token, maxAge }) {
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
  res.cookies.set(CSRF_COOKIE, csrfFor(token), cookieOptions(maxAge, false));
}

export function clearSessionCookies(store) {
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
}

export async function createSession(userId, db) {
  db ||= await getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, idle_expires_at) VALUES (?, ?, ?, ?, ?)',
    hash(token), userId, iso(now), iso(now + ABSOLUTE_DAYS * 864e5), iso(now + IDLE_SEC * 1000)
  );
  return { token, maxAge: ABSOLUTE_DAYS * 86400 };
}

export async function destroySession(token) {
  if (token) await (await getDb()).run('DELETE FROM auth_sessions WHERE token_hash = ?', hash(token));
}

export async function hasConsent(userId, db) {
  db ||= await getDb();
  const r = await db.get(
    `SELECT COUNT(*) n FROM user_consents WHERE user_id = ? AND version = ? AND agreed = 1 AND type IN (${CONSENT_TYPES.map(() => '?').join(',')})`,
    userId, CONSENT_VERSION, ...CONSENT_TYPES
  );
  return r.n === CONSENT_TYPES.length;
}

/**
 * 지금 요청의 세션. 한 요청 안에서는 한 번만 조회
 * @returns {{ user, consented, idleExpiresAt, loginAt } | { user: null, reason: null|'idle'|'expired' }}
 */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { user: null, reason: null };
  const db = await getDb();
  const row = await db.get(
    `SELECT u.*, s.created_at AS s_created, s.expires_at AS s_expires, s.idle_expires_at AS s_idle
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND u.deleted_at IS NULL`,
    hash(token)
  );
  if (!row) return { user: null, reason: null };
  const now = Date.now();
  const idleAt = row.s_idle ? parseTime(row.s_idle) : now + IDLE_SEC * 1000;
  if (parseTime(row.s_expires) <= now || idleAt <= now) {
    const reason = idleAt <= now ? 'idle' : 'expired';
    await db.run('DELETE FROM auth_sessions WHERE token_hash = ?', hash(token));
    if (reason === 'idle') await logAccess('idle_logout', row.id, db);
    return { user: null, reason };
  }
  // 요청이 올 때마다 하루 연장 (1분에 한 번만 기록)
  let idleExpiresAt = idleAt;
  if (idleAt - now < (IDLE_SEC - TOUCH_EVERY_SEC) * 1000) {
    idleExpiresAt = now + IDLE_SEC * 1000;
    await db.run('UPDATE auth_sessions SET idle_expires_at = ? WHERE token_hash = ?', iso(idleExpiresAt), hash(token));
  }
  const { s_created, s_expires, s_idle, ...user } = row;
  return {
    user,
    consented: await hasConsent(user.id, db),
    idleExpiresAt: Math.min(idleExpiresAt, parseTime(s_expires)),
    loginAt: parseTime(s_created),
  };
});

// 서버 컴포넌트·라우트 핸들러에서 지금 로그인한(동의까지 마친) 사용자
export async function getCurrentUser() {
  const s = await getSession();
  return s.user && s.consented ? s.user : null;
}

const apiError = (error, status) => Response.json({ error }, { status });

// 상태를 바꾸는 요청: 같은 사이트에서 온 것인지 + CSRF 토큰이 세션과 맞는지
export async function checkCsrf(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  const origin = request.headers.get('origin');
  if (origin && origin !== appOrigin(request) && origin !== new URL(request.url).origin) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const sent = request.headers.get('x-csrf-token') || '';
  if (!token) return true; // 세션이 없으면 아래에서 401
  const want = csrfFor(token);
  return sent.length === want.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(want));
}

/**
 * API용: 로그인·동의를 마치지 않았으면 401/403, CSRF가 맞지 않으면 403
 * 응답에 X-Idle-Expires(자동 로그아웃 시각, ms)를 붙여 화면이 남은 시간을 앎
 */
export function withUser(handler) {
  return async (request, ctx) => {
    if (!(await checkCsrf(request))) return apiError('csrf', 403);
    const s = await getSession();
    if (!s.user) return apiError(s.reason || 'unauthorized', 401);
    if (!s.consented) return apiError('consent', 403);
    try {
      const res = await handler(request, s.user, ctx);
      res.headers.set('X-Idle-Expires', String(s.idleExpiresAt));
      return res;
    } catch (e) {
      console.error(e);
      return apiError(e.status ? e.message : 'server_error', e.status || 500);
    }
  };
}

// 되돌릴 수 없는 작업 전: 로그인한 지 오래됐으면 다시 로그인 요구
export async function requireRecentLogin() {
  const s = await getSession();
  if (!s.loginAt || Date.now() - s.loginAt > REAUTH_SEC * 1000) {
    const e = new Error('reauth');
    e.status = 403;
    throw e;
  }
}

export function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}
