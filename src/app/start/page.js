import { getCurrentUser } from '@/lib/auth';
import { dashboard } from '@/lib/dashboard';
import StartApp from './StartApp';

// 로그인 전: 시작 화면 / 로그인 후: 바로 목차
export default async function Page({ searchParams }) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  return <StartApp initial={user ? await dashboard(user) : null} error={error || null} />;
}
