import { withUser } from '@/lib/auth';
import { dashboard, resetRecords } from '@/lib/dashboard';

// 학습 기록 초기화 (화면에서 두 번 눌러야 호출)
export const POST = withUser(async (_req, user) => {
  await resetRecords(user.id);
  return Response.json(await dashboard(user));
});
