import { withUser, requireRecentLogin } from '@/lib/auth';
import { dashboard, resetRecords } from '@/lib/dashboard';
import { logAccess } from '@/lib/accessLog';

// 학습 기록 초기화 (화면에서 두 번 눌러야 호출). 로그인한 지 오래됐으면 다시 로그인 요구
export const POST = withUser(async (_req, user) => {
  await requireRecentLogin();
  await resetRecords(user.id);
  await logAccess('reset', user.id);
  return Response.json(await dashboard(user));
});
