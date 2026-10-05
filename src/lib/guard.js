import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';

// 로그인한 사람만 보는 화면: 세션이 없으면 시작 화면으로
export async function requireLogin() {
  const user = await getCurrentUser();
  if (!user) redirect('/start');
  return user;
}
