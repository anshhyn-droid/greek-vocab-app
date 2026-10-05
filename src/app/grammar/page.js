import { requireLogin } from '@/lib/guard';
import { lessonInfo } from '@/lib/content';
import { STUDY_LESSON } from '@/lib/lesson';
import GrammarStudy from './GrammarStudy';

export default async function Page() {
  await requireLogin();
  return <GrammarStudy lesson={STUDY_LESSON} title={(await lessonInfo(STUDY_LESSON))?.title || ''} />;
}
