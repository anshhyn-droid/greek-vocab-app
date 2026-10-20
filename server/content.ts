// 서버가 채점할 때 쓰는 콘텐츠 (public/data/lNN.json). 화면과 같은 파일
import fs from 'node:fs';
import path from 'node:path';

interface Opt { id: string; options: string[]; answer: number; lesson: string }
interface LessonFile {
  words: { id: string; meaning: string; lesson: string }[];
  grammarLearning: Opt[];
  grammarQuestions: Opt[];
  sentences: { id: string; translation: string; lesson: string; parsing: { id: string }[] }[];
}

const cache = new Map<number, LessonFile | null>();
export function lessonFile(n: number): LessonFile | null {
  if (!cache.has(n)) {
    const p = path.join(process.cwd(), 'public', 'data', `l${String(n).padStart(2, '0')}.json`);
    cache.set(n, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
  }
  return cache.get(n)!;
}

export const READY = [3, 4, 5, 6, 7, 8];
export const lessonNoOf = (code: string) => Number(String(code).replace(/\D/g, ''));
// 문항 id → 과 번호 (W301 → 3, GL3001 → 3, GQ8123 → 8, E405 → 4, C:L03-1 → 3)
export function lessonOfItem(type: string, id: string): number | null {
  for (const n of READY) {
    const f = lessonFile(n);
    if (!f) continue;
    const hit =
      type === 'word' ? f.words.some((w) => w.id === id)
      : type === 'gram' ? f.grammarLearning.some((g) => g.id === id) || f.grammarQuestions.some((g) => g.id === id)
      : type === 'sent' ? f.sentences.some((s) => s.id === id)
      : type === 'concept' ? id.startsWith('L' + String(n).padStart(2, '0') + '-')
      : false;
    if (hit) return n;
  }
  return null;
}

// 서버 채점: 고른 답이 맞는지. 단어 = 뜻, 문법 = 보기 글자, 문장 = 'ok'(해석·파싱을 모두 맞힘) / 'knew'(테스트에서 스스로 판단)
export function grade(type: string, id: string, answer: string): boolean {
  const n = lessonOfItem(type, id);
  if (n == null) return false;
  const f = lessonFile(n)!;
  if (type === 'word') return f.words.find((w) => w.id === id)?.meaning === answer;
  if (type === 'gram') {
    const g = f.grammarLearning.find((x) => x.id === id) || f.grammarQuestions.find((x) => x.id === id);
    return !!g && g.options[g.answer] === answer;
  }
  if (type === 'sent') return answer === 'ok' || answer === 'knew';
  return false;
}

export function contentVersion(lessons: number[]): string {
  return lessons.map((n) => {
    try {
      const st = fs.statSync(path.join(process.cwd(), 'public', 'data', `l${String(n).padStart(2, '0')}.json`));
      return `${n}:${st.size}`;
    } catch {
      return `${n}:0`;
    }
  }).join(',');
}
