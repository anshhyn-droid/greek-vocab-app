// 1단계 임시 화면: 콘텐츠가 제대로 불러와지는지 확인 (제3과 단어 + 개념 표 첫 묶음, 과별 개수)
import { useEffect, useState } from 'react';
import ConceptSection from '../components/ConceptSection';
import { loadAllWords, loadLesson, loadLessonIndex } from '../data/content';
import type { Lesson, LessonIndex } from '../data/types';
import styles from './DataCheck.module.css';

export default function DataCheck() {
  const [idx, setIdx] = useState<LessonIndex | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const i = await loadLessonIndex();
      setIdx(i);
      setLessons(await Promise.all(i.ready.map(loadLesson)));
      setWordCount((await loadAllWords()).size);
    })().catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className={styles.page}>불러오기 실패: {error}</p>;
  const l3 = lessons.find((l) => l.lesson.no === 3);
  return (
    <main className={styles.page}>
      <h1>데이터 확인</h1>
      <p className={styles.muted}>목차 {idx?.lessons.length ?? '…'}과 · 학습 가능 {idx?.ready.join(', ')}과 · 모든 과 단어 {wordCount}개</p>

      <table className={styles.counts}>
        <thead>
          <tr><th>과</th><th>단어</th><th>문법 학습</th><th>문법 테스트</th><th>문장</th><th>개념 묶음</th></tr>
        </thead>
        <tbody>
          {lessons.map((l) => (
            <tr key={l.lesson.id} data-lesson={l.lesson.no}>
              <td>제{l.lesson.no}과</td>
              <td>{l.words.length}</td>
              <td>{l.grammarLearning.length}</td>
              <td data-gq>{l.grammarQuestions.length}</td>
              <td>{l.sentences.length}</td>
              <td>{l.concepts.sections.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {l3 && (
        <>
          <h2>제3과 단어 ({l3.words.length})</h2>
          <ul className={styles.words}>
            {l3.words.map((w) => (
              <li key={w.id}><span className="gk">{w.greek}</span> — {w.meaning}</li>
            ))}
          </ul>
          <h2>제3과 개념 표 첫 묶음</h2>
          <ConceptSection section={l3.concepts.sections[0]} />
        </>
      )}
    </main>
  );
}
