import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { dashboard } from '@/lib/dashboard';
import { openPending, PENDING_COOKIE } from '@/lib/google';
import StartApp from './StartApp';

const NOTICES = ['idle', 'withdrawn', 'reauth'];

// 로그인 전: 시작 화면 / 처음 로그인·약관 변경: 동의 화면 / 로그인 후: 바로 목차
export default async function Page({ searchParams }) {
  const { error, notice } = await searchParams;
  const s = await getSession();
  let consent = null;
  if (s.user && !s.consented) consent = 'renew';
  else if (!s.user && openPending((await cookies()).get(PENDING_COOKIE)?.value)) consent = 'new';
  return (
    <StartApp
      initial={s.user && s.consented ? await dashboard(s.user) : null}
      consent={consent}
      error={error || null}
      notice={s.reason === 'idle' ? 'idle' : NOTICES.includes(notice) ? notice : null}
    />
  );
}
