// 과·학습 공통 정의 (서버·클라이언트 모두 사용)

// 지금 학습 화면(/word, /grammar, /sentence)이 다루는 과
export const STUDY_LESSON = 3;
export const LESSON_COUNT = 28;

export const lessonCode = (n) => 'L' + String(n).padStart(2, '0');
export const lessonNum = (code) => parseInt(String(code).replace(/\D/g, ''), 10) || null;

// 과 메뉴 순서: 단어 → 문법 → 문장
export const STEPS = [
  { key: 'word', label: '단어', href: '/word' },
  { key: 'gram', label: '문법', href: '/grammar' },
  { key: 'sent', label: '문장', href: '/sentence' },
];
export const nextStepHref = (key) => {
  const i = STEPS.findIndex((s) => s.key === key);
  return STEPS[i + 1]?.href || '/';
};

export const GRAMMAR_PICK = 20; // 문법: 한 번에 무작위 20문항
export const REVIEW_GRAMMAR_PICK = 10; // 암기: 과마다 문법 무작위 10문항

export const MODE_LABEL = { word: '단어', gram: '문법', sent: '문장', review: '암기', ox: 'OX 카드', note: '오답 노트' };
