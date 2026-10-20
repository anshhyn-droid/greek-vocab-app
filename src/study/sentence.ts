// 문장 학습 도우미 (design/문장학습_명세.md): 해석 블록·함정 낱말·원형 보기·파싱 줄
import type { Codes, Lesson, Parsing, Sentence } from '../data/types';
// @ts-expect-error 함정 낱말 규칙(이전 앱에서 옮겨 옴, JS)
import { buildTraps, koTokens, verbStems } from './koTraps.js';

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const nfc = (s: string) => String(s || '').normalize('NFC');

export interface Block { t: string; ans: boolean }

// 함정 규칙에 쓸 한국어 동사 어간: 모든 과의 동사 뜻·파싱 뜻에서
export function stemsFrom(lessons: Lesson[]): string[] {
  const m: string[] = [];
  for (const l of lessons) {
    l.words.filter((w) => w.pos === '동사').forEach((w) => m.push(w.meaning));
    l.sentences.forEach((s) => s.parsing.forEach((p) => p.meaning && m.push(p.meaning)));
  }
  return verbStems(m);
}

// 해석 블록: 정답 번역을 띄어쓰기로 나눈 낱말 + 함정 낱말 2~3개 (문장부호 뺌, 정답과 같은 함정은 넣지 않음)
export function buildPool(s: Sentence, stems: string[]): { pool: Block[]; tokens: string[] } {
  const tokens: string[] = koTokens(s.translation);
  const t = buildTraps(tokens, stems) as { nounTraps: string[]; verbCandidates: string[] };
  const traps = shuffle([...new Set([...t.nounTraps, ...shuffle(t.verbCandidates).slice(0, 3)])].filter((x) => !tokens.includes(x))).slice(0, 3);
  return { tokens, pool: shuffle([...tokens.map((x) => ({ t: x, ans: true })), ...traps.map((x) => ({ t: x, ans: false }))]) };
}

// 같은 동사의 변화형(데이터에 나온 형태). 원형 보기의 오답 재료
export function formsByLemma(lessons: Lesson[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const l of lessons) for (const p of [...l.sentences.flatMap((s) => s.parsing), ...l.parsingExtra]) {
    const k = nfc(p.lemma);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(nfc(p.form).toLowerCase());
  }
  return m;
}

const ENDINGS: [RegExp, string[]][] = [
  [/ομαι$/, ['ομαι', 'ῃ', 'εται', 'ομεθα', 'εσθε', 'ονται']],
  [/ω$/, ['ω', 'εις', 'ει', 'ομεν', 'ετε', 'ουσι']],
];
const EIMI = ['εἰμί', 'εἶ', 'ἐστί', 'ἐσμέν', 'ἐστέ', 'εἰσί'];

// 원형 보기 4개: 기본형(1인칭 단수) 1 + 오답 3 (문장 속 형태 + 다른 인칭·수 형태)
export function lemmaOptions(p: Parsing, forms: Map<string, Set<string>>): string[] {
  const lem = nfc(p.lemma);
  const inSent = nfc(p.form).toLowerCase();
  let others: string[] = [];
  if (lem === 'εἰμί') others = EIMI.filter((f) => f !== lem);
  else for (const [re, ends] of ENDINGS) {
    if (re.test(lem)) { const stem = lem.replace(re, ''); others = ends.map((e) => stem + e).filter((f) => f !== lem); break; }
  }
  const seen = [...(forms.get(lem) || [])].filter((f) => f !== lem);
  const pool = [...new Set([...seen, ...others])].filter((f) => f !== lem && f !== inSent);
  const wrong = [...(inSent !== lem ? [inSent] : []), ...shuffle(pool)].slice(0, 3);
  return shuffle([lem, ...wrong]);
}

export interface Axis { key: 'lemma' | 'tense' | 'voice' | 'mood' | 'number' | 'person'; k: string; opts: [string, string][]; greek?: boolean }

// 파싱 여섯 줄: 원형·시제·태·법·수·인칭. 값이 없는 줄(예: εἰμί의 태)은 뺌
// 보기: 명세의 기본 보기 + 이 과에서 배우는 것(디포넌트·중간/수동)과 정답이 늘 들어 있도록
export function axesFor(p: Parsing, lemOpts: string[], codes: Codes, lesson: number): Axis[] {
  const lab = (group: keyof Codes, keys: string[]) => keys.map((c) => [c, codes[group][c] || c] as [string, string]);
  const withAnswer = (keys: string[], v: string | null) => (v && !keys.includes(v) ? [...keys, v] : keys);
  const voice = withAnswer(lesson >= 7 ? ['ACT', 'MID', 'PASS', 'DEP'] : ['ACT', 'MID', 'PASS'], p.voice);
  const all: (Axis | null)[] = [
    { key: 'lemma', k: '원형', greek: true, opts: lemOpts.map((l) => [l, l]) },
    p.tense ? { key: 'tense', k: '시제', opts: lab('tense', withAnswer(['PRES', 'IMPF', 'FUT', 'AOR'], p.tense)) } : null,
    p.voice ? { key: 'voice', k: '태', opts: lab('voice', voice) } : null,
    p.mood ? { key: 'mood', k: '법', opts: lab('mood', withAnswer(['IND', 'SUB', 'IMP'], p.mood)) } : null,
    p.number ? { key: 'number', k: '수', opts: lab('number', ['S', 'P']) } : null,
    p.person ? { key: 'person', k: '인칭', opts: lab('person', ['1p', '2p', '3p']) } : null,
  ];
  return all.filter((a): a is Axis => !!a);
}

export const answerOf = (p: Parsing, key: Axis['key']) => (key === 'lemma' ? nfc(p.lemma) : (p[key] as string));
