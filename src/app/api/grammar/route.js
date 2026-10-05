import { withUser } from '@/lib/auth';
import { grammarQuiz } from '@/lib/content';
import { STUDY_LESSON } from '@/lib/lesson';

// 문법 학습: 전체 문항 중 무작위 20개, 무작위 순서
export const GET = withUser(async () => Response.json(await grammarQuiz(STUDY_LESSON)));
