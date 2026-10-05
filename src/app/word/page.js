import { requireLogin } from '@/lib/guard';
import { lessonInfo } from '@/lib/content';
import { STUDY_LESSON } from '@/lib/lesson';
import WordStudy from './WordStudy';

export default async function Page() {
  await requireLogin();
  return <WordStudy lessonLabel={`${STUDY_LESSON}과 · ${(await lessonInfo(STUDY_LESSON))?.title || ''}`} />;
}
