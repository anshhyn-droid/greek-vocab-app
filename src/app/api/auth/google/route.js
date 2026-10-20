import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { cookieOptions, STATE_COOKIE, PKCE_COOKIE, appOrigin } from '@/lib/auth';
import { newPkce } from '@/lib/google';

// Google 로그인 시작: Google 기본 로그인 창으로 보냄 (state + PKCE)
export async function GET(request) {
  const origin = appOrigin(request);
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/start?error=config', origin));
  }
  const state = crypto.randomBytes(16).toString('base64url');
  const pkce = newPkce();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: origin + '/api/auth/callback/google',
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, cookieOptions(600));
  res.cookies.set(PKCE_COOKIE, pkce.verifier, cookieOptions(600));
  return res;
}
