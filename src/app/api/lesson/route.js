import { withUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { lessonInfo } from '@/lib/content';
import { progressByLesson } from '@/lib/dashboard';
import { STUDY_LESSON } from '@/lib/lesson';

// 과 메뉴: 과 정보 + 완료한 학습
export const GET = withUser(async (_req, user) => {
  const [info, progress] = await Promise.all([lessonInfo(STUDY_LESSON), progressByLesson(user.id)]);
  return Response.json({ ...info, done: progress[STUDY_LESSON] || [] });
});

// 기록 지우기: 이 과의 완료 기록만
export const DELETE = withUser(async (_req, user) => {
  await (await getDb()).run('DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', user.id, STUDY_LESSON);
  return Response.json({ done: [] });
});
