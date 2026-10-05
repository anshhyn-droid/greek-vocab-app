import { withUser } from '@/lib/auth';
import { wordQuiz } from '@/lib/content';
import { STUDY_LESSON } from '@/lib/lesson';

// 단어 학습: 단어마다 보기 4개(정답 + 같은 과 다른 뜻 3), 요청마다 새로 섞음
export const GET = withUser(async () => Response.json(await wordQuiz(STUDY_LESSON)));
