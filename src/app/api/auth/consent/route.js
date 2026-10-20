import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { appOrigin, checkCsrf, createSession, getSession, setSessionCookies } from '@/lib/auth';
import { CONSENT_TYPES } from '@/lib/consent';
import { openPending, PENDING_COOKIE } from '@/lib/google';
import { createUser, findGoogleUser, saveConsents } from '@/lib/users';
import { getDb } from '@/lib/db';
import { logAccess } from '@/lib/accessLog';

// 같은 사이트의 화면에서 보낸 요청만
const sameSite = (request) => request.headers.get('origin') === appOrigin(request) || request.headers.get('origin') === new URL(request.url).origin;

// 약관 동의: { age, terms, privacy } 모두 true여야 함
// 새 사용자(동의 대기 쿠키) → 가입 + 로그인 / 로그인한 사용자(약관 버전이 바뀜) → 새 버전 동의 기록
export async function POST(request) {
  if (!sameSite(request) || !(await checkCsrf(request))) return Response.json({ error: 'csrf' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!CONSENT_TYPES.every((t) => body[t] === true)) return Response.json({ error: 'consent_required' }, { status: 400 });

  const s = await getSession();
  const db = await getDb();
  if (s.user) {
    await db.transaction((tx) => saveConsents(tx, s.user.id));
    return Response.json({ ok: true });
  }

  const pending = openPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!pending) return Response.json({ error: 'expired' }, { status: 401 });
  // 두 번 눌렀거나 다른 탭에서 이미 가입했으면 그 계정으로
  const existing = await findGoogleUser(pending);
  const userId = existing || (await db.transaction((tx) => createUser(tx, pending)));
  if (existing) await db.transaction((tx) => saveConsents(tx, existing));
  const session = await createSession(userId);
  await logAccess('login', userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PENDING_COOKIE);
  setSessionCookies(res, session);
  return res;
}

// 동의하지 않고 취소: 받아 둔 Google 정보를 버림
export async function DELETE(request) {
  if (!sameSite(request)) return Response.json({ error: 'csrf' }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
