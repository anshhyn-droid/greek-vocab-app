import { redirect } from 'next/navigation';
import { getSession } from './auth';

// 로그인(약관 동의까지)한 사람만 보는 화면: 아니면 시작 화면으로
// 하루 미사용으로 끝난 세션이면 시작 화면 위쪽에 안내
export async function requireLogin() {
  const s = await getSession();
  if (!s.user) redirect(s.reason === 'idle' ? '/start?notice=idle' : '/start');
  if (!s.consented) redirect('/start');
  return s.user;
}
