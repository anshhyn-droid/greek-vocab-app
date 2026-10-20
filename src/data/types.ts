// 콘텐츠 JSON(public/data)의 모양. 열 이름은 data/convert_xlsx.mjs가 만든 그대로

export interface LessonInfo {
  id: string; // "L03"
  no: number;
  title: string;
}

export interface LessonIndex {
  lessons: LessonInfo[]; // 26과
  ready: number[]; // 학습할 수 있는 과 (3~8)
  conceptsOnly: number[]; // 개념 표만 있는 과 (2)
}

export interface Word {
  id: string; // "W301"
  lesson: string;
  greek: string;
  stem: string | null;
  pos: string | null; // 품사
  meaning: string;
  gender: string | null;
  declension: string | null;
  type: string | null; // codes.wordType
  note: string | null;
}

// 보기 4개 + 정답 번호(0~3). 문법 학습·문법 테스트가 같은 모양
export interface GrammarItem {
  id: string; // 학습 "GL3001" / 테스트 "GQ3001"
  lesson: string;
  prompt: string;
  target: string | null; // 강조할 형태
  options: string[];
  answer: number;
  explanation: string | null;
  page: string | null;
  note: string | null;
}

export interface Parsing {
  id: string; // "P307"
  sentence: string | null;
  word: string | null; // 단어 id (과를 넘어 가리킬 수 있음)
  pos: string | null;
  form: string; // 문장 속 형태
  lemma: string; // 기본형
  meaning: string | null;
  gender: string | null;
  number: string | null;
  case: string | null;
  tense: string | null;
  voice: string | null;
  mood: string | null;
  person: string | null;
  gloss: string | null; // 이 동사의 해석
  page: string | null;
}

export interface Sentence {
  id: string; // "E301"
  lesson: string;
  no: number;
  greek: string;
  translation: string; // 정답 번역 (띄어쓰기로 나눠 해석 블록)
  page: string | null;
  status: string | null;
  note: string | null;
  parsing: Parsing[];
}

export type ConceptBlock =
  | { type: 'p' | 'note' | 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

export interface ConceptSection {
  title: string;
  blocks: ConceptBlock[];
}

// 문법 개념 표. 묶음(섹션) 번호로 책갈피 id를 만듦: "L03-1"
export interface Concepts {
  title: string;
  source: string | null;
  sections: ConceptSection[];
}

export interface Lesson {
  lesson: LessonInfo;
  concepts: Concepts;
  words: Word[];
  grammarLearning: GrammarItem[]; // 문법 학습용
  grammarQuestions: GrammarItem[]; // 테스트용
  sentences: Sentence[];
  parsingExtra: Parsing[]; // 문장에 연결되지 않은 파싱
}

// 파싱 약어 → 한국어
export interface Codes {
  number: Record<string, string>;
  gender: Record<string, string>;
  case: Record<string, string>;
  tense: Record<string, string>;
  voice: Record<string, string>;
  mood: Record<string, string>;
  person: Record<string, string>;
  wordType: Record<string, string>;
}
