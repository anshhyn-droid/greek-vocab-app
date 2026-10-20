// 콘텐츠 불러오기. 같은 파일은 한 번만 받아 둠
import type { Codes, Lesson, LessonIndex, Word } from './types';

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/${file}`).then((r) => {
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(file)); // 실패하면 다음에 다시 시도
    cache.set(file, p);
  }
  return cache.get(file) as Promise<T>;
}

export const lessonCode = (n: number) => 'L' + String(n).padStart(2, '0');
export const lessonNo = (code: string) => Number(code.replace(/\D/g, ''));

export const loadLessonIndex = () => getJson<LessonIndex>('lessons.json');
export const loadCodes = () => getJson<Codes>('codes.json');

// 과 번호로 그 과의 단어·문법·문장·개념 표
export async function loadLesson(n: number): Promise<Lesson> {
  return getJson<Lesson>(`l${String(n).padStart(2, '0')}.json`);
}

// 파일이 있는 과: 학습 과 + 개념 표만 있는 과
export async function lessonsWithData(): Promise<number[]> {
  const idx = await loadLessonIndex();
  return [...new Set([...idx.conceptsOnly, ...idx.ready])].sort((a, b) => a - b);
}

// 단어 참조는 과를 넘으므로(제4과 문장 → 제3과 단어) 모든 과 단어를 한꺼번에 id로
let wordMap: Promise<Map<string, Word>> | null = null;
export function loadAllWords(): Promise<Map<string, Word>> {
  wordMap ??= (async () => {
    const lessons = await Promise.all((await lessonsWithData()).map(loadLesson));
    return new Map(lessons.flatMap((l) => l.words).map((w) => [w.id, w]));
  })().catch((e) => {
    wordMap = null;
    throw e;
  });
  return wordMap;
}

export async function findWord(id: string): Promise<Word | undefined> {
  return (await loadAllWords()).get(id);
}
