import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createSession, cookieOptions, setSessionCookies, STATE_COOKIE, PKCE_COOKIE, appOrigin } from '@/lib/auth';
import { verifyIdToken, sealPending, PENDING_COOKIE, PENDING_SEC } from '@/lib/google';
import { findGoogleUser } from '@/lib/users';
import { logAccess, purgeOldLogs } from '@/lib/accessLog';

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Google이 돌려보낸 code로 ID 토큰을 받아 확인한 뒤 로그인 처리
// 이미 가입한 사람은 바로 로그인, 처음이면 약관 동의 화면으로 (동의 전에는 계정을 만들지 않음)
export async function GET(request) {
  const origin = appOrigin(request);
  const done = (path) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(PKCE_COOKIE);
    return res;
  };
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const verifier = request.cookies.get(PKCE_COOKIE)?.value;
  if (!code || !verifier || !same(params.get('state'), request.cookies.get(STATE_COOKIE)?.value)) return done('/start?error=login');

  let info;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: origin + '/api/auth/callback/google',
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return done('/start?error=login');
    // Google 토큰은 이름·이메일 확인에만 쓰고 저장하지 않음
    info = await verifyIdToken((await tokenRes.json()).id_token);
  } catch (e) {
    console.error(e);
    return done('/start?error=login');
  }

  const userId = await findGoogleUser(info);
  if (!userId) {
    const res = done('/start');
    res.cookies.set(PENDING_COOKIE, sealPending(info), cookieOptions(PENDING_SEC));
    return res;
  }
  const session = await createSession(userId);
  await logAccess('login', userId);
  await purgeOldLogs();
  const res = done('/start');
  setSessionCookies(res, session);
  return res;
}
