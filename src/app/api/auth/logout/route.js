import { cookies } from 'next/headers';
import { checkCsrf, clearSessionCookies, destroySession, getSession, SESSION_COOKIE } from '@/lib/auth';
import { logAccess } from '@/lib/accessLog';

// ?reason=idle: 화면의 자동 로그아웃 (남은 시간이 0이 됨)
export async function POST(request) {
  if (!(await checkCsrf(request))) return Response.json({ error: 'csrf' }, { status: 403 });
  const store = await cookies();
  const { user } = await getSession();
  const idle = new URL(request.url).searchParams.get('reason') === 'idle';
  await destroySession(store.get(SESSION_COOKIE)?.value);
  if (user) await logAccess(idle ? 'idle_logout' : 'logout', user.id);
  clearSessionCookies(store);
  return Response.json({ ok: true });
}
