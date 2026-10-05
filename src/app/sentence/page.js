import { requireLogin } from '@/lib/guard';
import { STUDY_LESSON } from '@/lib/lesson';
import SentenceStudy from './SentenceStudy';

export default async function Page() {
  await requireLogin();
  return <SentenceStudy lesson={STUDY_LESSON} />;
}
