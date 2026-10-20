import { cookies } from 'next/headers';
import { withUser, requireRecentLogin, badRequest, clearSessionCookies } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteUser } from '@/lib/users';
import { logAccess } from '@/lib/accessLog';

// 회원 탈퇴 (보안·개인정보 명세 3): { confirm: true }
// 한 트랜잭션으로 사용자와 연결된 모든 행 삭제, 세션 폐기. Google 토큰은 저장하지 않으므로 지울 것이 없음
export const POST = withUser(async (request, user) => {
  const { confirm } = await request.json().catch(() => ({}));
  if (confirm !== true) throw badRequest('confirm');
  await requireRecentLogin();
  await (await getDb()).transaction(async (tx) => {
    await deleteUser(tx, user.id);
    await logAccess('withdraw', null, tx);
  });
  clearSessionCookies(await cookies());
  return Response.json({ ok: true });
});
