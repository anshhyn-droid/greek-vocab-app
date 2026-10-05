import { withUser } from '@/lib/auth';
import { reviewItems } from '@/lib/content';
import { LESSON_COUNT } from '@/lib/lesson';

const MODES = ['word', 'gram', 'sent', 'ox'];

// 암기 문항: ?lessons=3,5&modes=word,gram&fav=1  또는  ?note=1
export const GET = withUser(async (request, user) => {
  const p = new URL(request.url).searchParams;
  const lessons = (p.get('lessons') || '').split(',').map(Number).filter((n) => n >= 1 && n <= LESSON_COUNT);
  const modes = (p.get('modes') || '').split(',').filter((m) => MODES.includes(m));
  return Response.json(await reviewItems({ lessons, modes, favOnly: p.get('fav') === '1', note: p.get('note') === '1' }, user.id));
});
