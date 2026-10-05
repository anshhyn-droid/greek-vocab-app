import { NextResponse } from 'next/server';
import { createSession, cookieOptions, SESSION_COOKIE, STATE_COOKIE, appOrigin } from '@/lib/auth';
import { upsertGoogleUser } from '@/lib/users';

// Google이 돌려보낸 code로 사용자 정보를 받아 로그인 처리
export async function GET(request) {
  const origin = appOrigin(request);
  const fail = (why) => {
    const res = NextResponse.redirect(new URL('/start?error=' + why, origin));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state || state !== request.cookies.get(STATE_COOKIE)?.value) return fail('login');

  let info;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: origin + '/api/auth/callback/google',
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('login');
    const { access_token } = await tokenRes.json();
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + access_token },
    });
    if (!infoRes.ok) return fail('login');
    info = await infoRes.json();
  } catch (e) {
    console.error(e);
    return fail('login');
  }
  if (!info.sub || !info.email) return fail('login');

  const userId = await upsertGoogleUser(info);
  const { token, maxAge } = await createSession(userId);
  const res = NextResponse.redirect(new URL('/start', origin));
  res.cookies.delete(STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
  return res;
}
