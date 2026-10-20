// 과 메뉴 (design/Lesson Menu.dc.html): 과 제목 + 단어·문법·문장 칸
// 진행 중이면 '이어서', 안 했으면 '다음/시작', 끝났으면 완료. 맨 아래 별도 '이어서' 버튼은 두지 않음
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { BlocksIcon, BookA, ChevronLeft, ListChecks } from 'lucide-react';
import BookPages from '../components/book/BookPages';
import { api } from '../lib/api';
import { KINDS, isDone, nextKind, runOf, useHome, type Kind } from '../lib/home';
import { shortTitle, studyPath } from '../lib/lessons';
import { loadLesson } from '../data/content';
import type { Lesson } from '../data/types';
import { useBookSize } from '../lib/viewport';
import styles from './LessonMenu.module.css';

const INFO: Record<Kind, { title: string; sub: string; icon: typeof BookA; count: (l: Lesson) => string }> = {
  word: { title: '단어 학습', sub: '뜻을 보며 배운 뒤, 단어만 보고 외웁니다.', icon: BookA, count: (l) => `단어 ${l.words.length}개` },
  gram: { title: '문법 학습', sub: '개념 표를 정리하고, 문제로 확인합니다.', icon: ListChecks, count: (l) => `${l.grammarLearning.length}문항` },
  sent: { title: '문장 학습', sub: '헬라어 문장을 해석 블록으로 풀고, 동사를 원형부터 인칭까지 파싱합니다.', icon: BlocksIcon, count: (l) => `${l.sentences.length}문장` },
};

export default function LessonMenu() {
  const n = Number(useParams().n);
  const navigate = useNavigate();
  const { narrow } = useBookSize();
  const { data, index, reload } = useHome();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  useEffect(() => { loadLesson(n).then(setLesson).catch(() => setLesson(null)); }, [n]);

  if (index && !index.ready.includes(n)) return <Navigate to="/learn" replace />;
  if (!data || !index || !lesson) return <BookPages left={null} right={null} />;

  const title = shortTitle(lesson.lesson.title);
  const doneN = KINDS.filter(({ k }) => isDone(data, n, k)).length;
  const nx = nextKind(data, n);
  const clear = async () => {
    await api(`/api/progress?lesson=${n}`, { method: 'DELETE' }).catch(() => {});
    reload();
  };

  const left = (
    <div className={styles.left}>
      <div className={styles.top}>
        <button onClick={() => navigate('/learn')} title="학습으로" className={styles.back}><ChevronLeft size={18} strokeWidth={2.75} /></button>
        <div className={styles.topText}>
          <b>제{n}과</b>
          <span>성경 헬라어</span>
        </div>
      </div>
      <div className={styles.hero}>
        <span aria-hidden="true" className={styles.bigNum}>{n}</span>
        <div className={styles.heroText}>
          <span className={styles.heroN}>{n}과</span>
          <span className={styles.heroTitle}>{title}</span>
          <span className={styles.heroSub}>단어를 익히고, 문법을 확인한 뒤, 연습 문장을 해석하고 파싱합니다.</span>
        </div>
        <div className={styles.prog}>
          <div className={styles.progBar}><div style={{ width: Math.round((doneN / 3) * 100) + '%' }} /></div>
          <span className={styles.progLabel}>{doneN} / 3 완료</span>
          {(doneN > 0 || data.runs.some((r) => r.lesson === n)) && <button onClick={clear} className={styles.clear}>기록 지우기</button>}
        </div>
      </div>
    </div>
  );

  const right = (
    <div className={styles.items}>
      {KINDS.map(({ k }) => {
        const it = INFO[k], run = runOf(data, n, k), done = isDone(data, n, k) && !run, next = !done && k === nx;
        const badge = run ? `이어서 · ${run.at} / ${run.of}` : done ? '완료' : next && doneN > 0 ? '다음' : '시작';
        const tone = done ? 'done' : run || next ? 'next' : 'todo';
        return (
          <button key={k} onClick={() => navigate(studyPath(n, k))} className={styles.item} data-tone={tone}>
            <span className={styles.icon}><it.icon size={20} strokeWidth={2.75} /></span>
            <div className={styles.itemText}>
              <div><b>{it.title}</b><span>{it.count(lesson)}</span></div>
              <span>{it.sub}</span>
            </div>
            <span className={styles.badge}>{badge}</span>
          </button>
        );
      })}
    </div>
  );

  if (narrow)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {left}
        {right}
      </div>
    );
  return <BookPages leftPad="34px 36px" rightPad="104px 36px 34px" left={left} right={right} />;
}
