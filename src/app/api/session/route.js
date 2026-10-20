import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkCsrf, cookieOptions, csrfFor, CSRF_COOKIE, getSession, SESSION_COOKIE } from '@/lib/auth';

// 자동 로그아웃 안내용: 남은 시각(ms). 이 요청도 사용으로 보고 연장됨
// CSRF 쿠키가 없으면(이 기능 전에 로그인한 세션) 여기서 만들어 줌
async function state() {
  const s = await getSession();
  if (!s.user) return NextResponse.json({ error: s.reason || 'unauthorized' }, { status: 401 });
  const res = NextResponse.json({ idleExpiresAt: s.idleExpiresAt });
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!store.get(CSRF_COOKIE)) res.cookies.set(CSRF_COOKIE, csrfFor(token), cookieOptions(30 * 86400, false));
  return res;
}

export const GET = state;

// "계속 사용하기"
export async function POST(request) {
  if (!(await checkCsrf(request))) return Response.json({ error: 'csrf' }, { status: 403 });
  return state();
}
