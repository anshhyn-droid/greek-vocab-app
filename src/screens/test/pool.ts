// 테스트 문항 재료: 학습 가능한 모든 과의 콘텐츠를 한 번에
import { loadCodes, loadLesson, loadLessonIndex } from '../../data/content';
import type { Codes, GrammarItem, Lesson, Sentence, Word } from '../../data/types';

export type TKind = 'word' | 'gram' | 'sent' | 'flash';
export type ItemType = 'word' | 'gram' | 'sent';
export interface TItem { t: TKind; id: string; lesson: number }

export interface Library {
  ready: number[];
  lessons: Map<number, Lesson>;
  codes: Codes;
  word(id: string): Word | undefined;
  gram(id: string): GrammarItem | undefined; // 학습·테스트 문항 모두
  sent(id: string): Sentence | undefined;
  lessonOf(type: string, id: string): number | undefined;
}

export async function loadLibrary(): Promise<Library> {
  const [idx, codes] = await Promise.all([loadLessonIndex(), loadCodes()]);
  const all = await Promise.all(idx.ready.map((n) => loadLesson(n).then((l) => [n, l] as const)));
  const lessons = new Map(all);
  const words = new Map<string, [Word, number]>(), grams = new Map<string, [GrammarItem, number]>(), sents = new Map<string, [Sentence, number]>();
  for (const [n, l] of lessons) {
    l.words.forEach((w) => words.set(w.id, [w, n]));
    [...l.grammarLearning, ...l.grammarQuestions].forEach((g) => grams.set(g.id, [g, n]));
    l.sentences.forEach((s) => sents.set(s.id, [s, n]));
  }
  return {
    ready: idx.ready,
    lessons,
    codes,
    word: (id) => words.get(id)?.[0],
    gram: (id) => grams.get(id)?.[0],
    sent: (id) => sents.get(id)?.[0],
    lessonOf: (type, id) => (type === 'word' ? words : type === 'gram' ? grams : type === 'sent' ? sents : null)?.get(id)?.[1] ?? (type === 'concept' ? Number(id.slice(1, 3)) : undefined),
  };
}

// 목록에 보일 이름: 단어·문장은 헬라어, 문법은 문제
export function labelOf(lib: Library, type: string, id: string): string | null {
  if (type === 'word') return lib.word(id)?.greek ?? null;
  if (type === 'gram') return lib.gram(id)?.prompt ?? null;
  if (type === 'sent') return lib.sent(id)?.greek ?? null;
  if (type === 'concept') {
    const n = Number(id.slice(1, 3)), i = Number(id.split('-')[1]) - 1;
    const sec = lib.lessons.get(n)?.concepts.sections[i];
    return sec ? sec.title || `제${n}과 개념 표 ${i + 1}` : null;
  }
  return null;
}

export const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export const KIND: Record<TKind, string> = { word: '단어', gram: '문법', sent: '문장', flash: '플래시 카드' };
export const typeOf = (k: TKind): ItemType => (k === 'flash' ? 'word' : k);
