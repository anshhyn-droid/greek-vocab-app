import { withUser } from '@/lib/auth';
import { sentenceQuiz } from '@/lib/content';
import { STUDY_LESSON } from '@/lib/lesson';

// 문장 학습: 해석 블록(정답 + 함정)과 원형 보기를 요청마다 새로 섞음
export const GET = withUser(async () => Response.json(await sentenceQuiz(STUDY_LESSON)));
