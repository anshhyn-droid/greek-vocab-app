import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

export const SESSION_COOKIE = 'gk_session';
export const STATE_COOKIE = 'gk_oauth_state';
export const appOrigin = (request) => process.env.APP_URL || new URL(request.url).origin;
const SESSION_DAYS = 30;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function cookieOptions(maxAgeSec) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSec,
  };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await (await getDb()).run('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', hash(token), userId, expires);
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export async function destroySession(token) {
  if (token) await (await getDb()).run('DELETE FROM auth_sessions WHERE token_hash = ?', hash(token));
}

async function userFromToken(token) {
  if (!token) return null;
  return (
    (await (await getDb()).get(
      `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
      hash(token),
      new Date().toISOString()
    )) || null
  );
}

// 서버 컴포넌트·라우트 핸들러에서 지금 로그인한 사용자
export async function getCurrentUser() {
  const store = await cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
}

// API용: 로그인하지 않았으면 401
export function withUser(handler) {
  return async (request, ctx) => {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      return await handler(request, user, ctx);
    } catch (e) {
      console.error(e);
      return Response.json({ error: e.status ? e.message : 'server_error' }, { status: e.status || 500 });
    }
  };
}

export function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}
