import { withUser } from '@/lib/auth';
import { reviewMeta } from '@/lib/content';

// 암기 설정 화면: 과별 문항 수, 오답 노트, 즐겨찾기 수
export const GET = withUser(async (_req, user) => Response.json(await reviewMeta(user.id)));
