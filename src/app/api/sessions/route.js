import { withUser } from '@/lib/auth';
import { completeSession } from '@/lib/record';

// 학습·암기 완료: 서버가 보상을 계산하고 기록을 저장
export const POST = withUser(async (request, user) => Response.json(await completeSession(user, await request.json())));
