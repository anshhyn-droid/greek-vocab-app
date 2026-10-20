// Google 로그인 → (처음이면) 약관 동의 → 가입 / 로그아웃
import crypto from 'node:crypto';
import { getDb, type Db } from '../db.js';
import { HttpError, appOrigin, body, clearCookie, cookie, json, readCookies, redirect } from '../http.js';
import { PENDING_COOKIE, PENDING_SEC, newPkce, openPending, sealPending, verifyIdToken, type GoogleClaims } from '../google.js';
import { CONSENT_TYPES, CONSENT_VERSION, checkCsrf, clearSession, createSession, endSession, getSession, hasConsent, logAccess, purgeOldLogs, type Session } from '../session.js';

const STATE = 'gk_oauth_state';
const PKCE = 'gk_oauth_pkce';
const callbackUrl = (req: Request) => appOrigin(req) + '/api/auth/callback/google';
const same = (a?: string | null, b?: string) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// 로그인 시작: Google 계정 선택 창으로
export async function googleStart(req: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return redirect('/?error=config');
  const state = crypto.randomBytes(16).toString('base64url');
  const pkce = newPkce();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return redirect(url.toString(), [cookie(STATE, state, 600), cookie(PKCE, pkce.verifier, 600)]);
}

// Google이 돌려보냄: ID 토큰 확인 → 가입한 사람은 로그인, 처음이면 동의 대기(계정은 아직 안 만듦)
export async function googleCallback(req: Request) {
  const c = readCookies(req);
  const q = new URL(req.url).searchParams;
  const done = (to: string, extra: string[] = []) => redirect(to, [clearCookie(STATE), clearCookie(PKCE), ...extra]);
  if (!q.get('code') || !c[PKCE] || !same(q.get('state'), c[STATE])) return done('/?error=login');
  let info: GoogleClaims;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: q.get('code')!, code_verifier: c[PKCE],
        client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl(req), grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) return done('/?error=login');
    // Google 토큰은 본인 확인에만 쓰고 저장하지 않음
    info = await verifyIdToken(((await res.json()) as { id_token: string }).id_token);
  } catch (e) {
    console.error(e);
    return done('/?error=login');
  }
  const db = await getDb();
  const u = await db.get<{ id: string }>('SELECT id FROM users WHERE google_sub = ?', info.sub);
  if (!u) return done('/', [cookie(PENDING_COOKIE, sealPending(info), PENDING_SEC)]);
  await db.run('UPDATE users SET email = ?, last_login_at = ? WHERE id = ?', info.email, new Date().toISOString(), u.id);
  await logAccess(req, 'login', u.id, db);
  await purgeOldLogs();
  return done('/', await createSession(u.id, db));
}

async function saveConsents(db: Db, userId: string) {
  const at = new Date().toISOString();
  for (const t of CONSENT_TYPES) {
    await db.run('INSERT OR REPLACE INTO user_consents (user_id, type, version, agreed, agreed_at) VALUES (?, ?, ?, 1, ?)', userId, t, CONSENT_VERSION, at);
  }
}

const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]', 'g');
const cleanName = (v: unknown) => [...String(v ?? '').replace(CONTROL, '').trim()].slice(0, 20).join('').trim();

// 약관 동의 { age, terms, privacy } 모두 true → 새 사용자: 가입(users·동의·설정·목표·통계) + 로그인 / 기존 사용자: 새 버전 동의
export async function consent(req: Request) {
  if (!checkCsrf(req)) throw new HttpError(403, 'csrf');
  const b = await body(req);
  if (!CONSENT_TYPES.every((t) => b[t] === true)) throw new HttpError(400, 'consent_required');
  const db = await getDb();
  const s = await getSession(req);
  if (s.user) {
    await db.tx((tx) => saveConsents(tx, s.user!.id));
    return json({ ok: true });
  }
  const p = openPending(readCookies(req)[PENDING_COOKIE]);
  if (!p) throw new HttpError(401, 'expired');
  const tz = typeof b.timezone === 'string' && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(b.timezone) ? b.timezone : 'Asia/Seoul';
  const userId = await db.tx(async (tx) => {
    const found = await tx.get<{ id: string }>('SELECT id FROM users WHERE google_sub = ?', p.sub); // 두 번 눌렀을 때
    const id = found?.id ?? crypto.randomUUID();
    if (!found) {
      await tx.run('INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)', id, p.sub, p.email, cleanName(p.name) || cleanName(p.email.split('@')[0]) || '학습자');
      await tx.run('INSERT INTO user_settings (user_id, font_size, timezone) VALUES (?, ?, ?)', id, 'm', tz);
      await tx.run('INSERT INTO user_goals (user_id) VALUES (?)', id);
      await tx.run('INSERT INTO user_stats (user_id) VALUES (?)', id);
    }
    await saveConsents(tx, id);
    return id;
  });
  await logAccess(req, 'login', userId, db);
  const h = new Headers();
  [...(await createSession(userId, db)), clearCookie(PENDING_COOKIE)].forEach((c) => h.append('set-cookie', c));
  return json({ ok: true }, 200, h);
}

// 동의하지 않고 취소: 받아 둔 Google 정보를 버림 (기존 사용자는 로그아웃)
export async function consentCancel(req: Request) {
  if (!checkCsrf(req)) throw new HttpError(403, 'csrf');
  await endSession(req, 'logout');
  const h = new Headers();
  [clearCookie(PENDING_COOKIE), ...clearSession()].forEach((c) => h.append('set-cookie', c));
  return json({ ok: true }, 200, h);
}

// 로그아웃 { reason: 'idle' | 'manual' }
export async function logout(req: Request) {
  if (!checkCsrf(req)) throw new HttpError(403, 'csrf');
  const s = await getSession(req);
  const idle = (await body(req)).reason === 'idle';
  await endSession(req, idle ? 'idle' : 'logout');
  if (s.user) await logAccess(req, idle ? 'idle_logout' : 'logout', s.user.id);
  const h = new Headers();
  clearSession().forEach((c) => h.append('set-cookie', c));
  return json({ ok: true }, 200, h);
}

// 화면이 처음 묻는 것: 로그인 상태
export async function me(req: Request) {
  const s = await getSession(req);
  if (!s.user) {
    if (openPending(readCookies(req)[PENDING_COOKIE])) return json({ status: 'needsConsent' });
    return json({ status: 'signedOut', reason: s.reason });
  }
  const ss = s as Session;
  if (!ss.consented || !(await hasConsent(ss.user.id, await getDb()))) return json({ status: 'needsConsent' });
  const fs = await (await getDb()).get<{ font_size: string }>('SELECT font_size FROM user_settings WHERE user_id = ?', ss.user.id);
  return json({ status: 'ready', profile: ss.user, idleExpiresAt: ss.idleExpiresAt, fontSize: fs?.font_size || 'm' });
}
