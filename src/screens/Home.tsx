// 학습 홈 (design/Start.dc.html "학습"). 왼쪽: 지금 할 과 책갈피 + 단어·문법·문장 진도 + 오늘의 목표 / 오른쪽: 목차 26과
// 폰: 오늘의 목표 → 책갈피가 달린 지금 할 과 → 목차
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookPages from '../components/book/BookPages';
import GoalDialog from '../components/GoalDialog';
import { KINDS, currentLesson, isDone, nextKind, runOf, useHome, type HomeData, type Kind } from '../lib/home';
import { lessonPath, shortTitle, studyPath } from '../lib/lessons';
import { useBookSize } from '../lib/viewport';
import type { LessonIndex } from '../data/types';
import styles from './Home.module.css';

export default function Home() {
  const { data, index, error, reload, stepGoal } = useHome();
  const navigate = useNavigate();
  const size = useBookSize();
  const [editGoal, setEditGoal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (error) return <BookPages left={<LoadFail onRetry={reload} />} right={null} />;
  if (!data || !index) return <BookPages left={null} right={null} />;

  const cur = currentLesson(data, index.ready);
  const titleOf = (n: number) => shortTitle(index.lessons.find((l) => l.no === n)?.title || '');
  const open = (n: number) => {
    if (index.ready.includes(n)) return navigate(lessonPath(n));
    setToast(`제${n}과는 준비 중입니다`);
    setTimeout(() => setToast(null), 1600);
  };
  const steps = <StepRows data={data} n={cur} onOpen={(k) => navigate(studyPath(cur, k))} small={size.narrow} />;
  const goal = <Goal data={data} onEdit={() => setEditGoal(true)} phone={size.narrow} />;
  const toc = <Toc data={data} index={index} cur={cur} onOpen={open} titleOf={titleOf} phone={size.narrow} />;

  // 책갈피 폭: 왼쪽 쪽 폭의 31% (100~136px)
  const W = Math.round(Math.max(100, Math.min(136, ((size.BW - 26) / 2) * 0.31)));
  // 낮은 책(높이 600 미만)은 책갈피·글자를 줄여 왼쪽 쪽이 넘치지 않게
  const compact = size.BH < 600;

  return (
    <>
      {size.narrow ? (
        <div className={styles.phone}>
          <div className={styles.box}>{goal}</div>
          <div className={`${styles.box} ${styles.curBox}`}>
            <button onClick={() => open(cur)} className={styles.mRibbon} title="이어서 학습하기">
              <Ribbon n={cur} small />
            </button>
            <span className={styles.mCurName}>{titleOf(cur)}</span>
            {steps}
          </div>
          <div className={`${styles.box} ${styles.mToc}`}>{toc}</div>
        </div>
      ) : (
        <BookPages
          leftPad="40px 34px 28px 30px"
          rightPad="52px 36px 0 52px"
          left={
            <div className={styles.left} data-compact={compact}>
              <div className={styles.curRow}>
                <button onClick={() => open(cur)} className={styles.ribbon} data-compact={compact} style={{ width: W }} title="이어서 학습하기">
                  <Ribbon n={cur} w={W} compact={compact} />
                </button>
                <div className={styles.curText}>
                  <span className={styles.curName}>{titleOf(cur)}</span>
                  {steps}
                </div>
              </div>
              <div className={styles.goalWrap}>{goal}</div>
            </div>
          }
          right={toc}
        />
      )}
      {editGoal && <GoalDialog goal={data.goal} onStep={stepGoal} onClose={() => setEditGoal(false)} />}
      {toast && <div className={styles.toast} style={{ bottom: size.narrow ? 96 : 28 }}>{toast}</div>}
    </>
  );
}

// 가죽 책갈피: 지금 할 과 · N과 · 이어서 학습하기 →
function Ribbon({ n, w = 86, small, compact }: { n: number; w?: number; small?: boolean; compact?: boolean }) {
  const d = 9.75, sl = 80 / w, q = d * Math.sqrt(1 + sl * sl);
  return (
    <span className={styles.ribbonBody} data-small={!!small} data-compact={!!compact}>
      {!small && (
        <>
          <span className={styles.stitch} />
          <svg width={w} height="60" viewBox={`0 0 ${w} 60`} className={styles.stitchTip} aria-hidden="true">
            <path d={`M${d} 0V${(20 + sl * d - q).toFixed(1)}L${w / 2} ${(60 - q).toFixed(1)}L${w - d} ${(20 + sl * d - q).toFixed(1)}V0`} fill="none" stroke="rgba(255,244,224,.42)" strokeWidth="1.5" strokeDasharray="4.5 3" />
          </svg>
        </>
      )}
      {small && <span className={styles.stitchSmall} />}
      <span className={styles.ribbonInner}>
        <span className={styles.rLabel}>지금 할 과</span>
        {!small && !compact && <span className={styles.rRule} />}
        <span className={styles.rNum}><b>{n}</b>과</span>
        {!small && !compact && <span className={styles.rRule} />}
        <span className={styles.rGo}>
          <span>이어서<br />학습하기</span>
          <span className={styles.rArrow}>→</span>
        </span>
      </span>
    </span>
  );
}

// 단어·문법·문장 줄: 점선으로 이어진 진도. 완료=세이지 ✓, 이어서 할 것=작은 책갈피와 '이어서'
function StepRows({ data, n, onOpen, small }: { data: HomeData; n: number; onOpen: (k: Kind) => void; small?: boolean }) {
  const nx = nextKind(data, n);
  return (
    <div className={styles.steps} data-small={!!small}>
      {KINDS.map(({ k, label }) => {
        const done = isDone(data, n, k) && !runOf(data, n, k);
        const curr = !done && k === nx;
        return (
          <button key={k} onClick={() => onOpen(k)} className={styles.step} title={`${label} 학습으로`}>
            <span className={styles.stepK}>{label}</span>
            <span className={styles.dots} style={{ borderColor: done ? 'var(--sage)' : curr ? 'var(--accent)' : 'rgba(140,73,26,.3)' }} />
            <span style={{ color: done ? 'var(--sage-ink)' : curr ? 'var(--accent-ink)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{done ? '완료' : curr ? '이어서' : '시작 전'}</span>
            <Mark state={done ? 'done' : curr ? 'cur' : 'todo'} color="#a85c2b" />
          </button>
        );
      })}
    </div>
  );
}

function Mark({ state, color = 'var(--accent)' }: { state: 'done' | 'cur' | 'todo'; color?: string }) {
  if (state === 'done') return <span className={styles.check}>✓</span>;
  if (state === 'cur') return <span className={styles.mini}><span style={{ background: color }} /></span>;
  return <span style={{ width: 20, flex: 'none' }} />;
}

// 오늘의 목표: 전체 막대 + 종류별 막대와 "4 / 8" (다 채우면 세이지)
function Goal({ data, onEdit, phone }: { data: HomeData; onEdit: () => void; phone: boolean }) {
  const part = (k: Kind) => Math.min(data.done[k], data.goal[k]);
  const tot = KINDS.reduce((a, { k }) => a + part(k), 0);
  const sum = KINDS.reduce((a, { k }) => a + data.goal[k], 0);
  const pct = (a: number, b: number) => Math.round((a / Math.max(1, b)) * 100) + '%';
  return (
    <div className={styles.goal} data-phone={phone}>
      <div className={styles.goalHead}>
        <span className={styles.goalTitle}>오늘의 목표</span>
        <span className={styles.goalShort}>{tot} / {sum}</span>
        <button onClick={onEdit} className={styles.edit} title="오늘의 목표 수정">수정</button>
      </div>
      <div className={styles.bar}><div style={{ width: pct(tot, sum) }} /></div>
      {phone ? (
        <div className={styles.chips}>
          {KINDS.map(({ k, label }) => {
            const full = part(k) >= data.goal[k] && data.goal[k] > 0;
            return (
              <div key={k} className={styles.chip} data-full={full}>
                <span>{label}</span>
                <b>{part(k)} / {data.goal[k]}</b>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.goalRows}>
          {KINDS.map(({ k, label }) => {
            const full = part(k) >= data.goal[k] && data.goal[k] > 0;
            return (
              <div key={k} className={styles.goalRow}>
                <span>{label}</span>
                <div className={styles.miniBar}><div style={{ width: pct(part(k), data.goal[k]), background: full ? 'var(--sage)' : 'var(--accent)' }} /></div>
                <b style={{ color: full ? 'var(--sage-ink)' : 'var(--muted)' }}>{part(k)} / {data.goal[k]}</b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 목차 26과: 과 번호·제목·세 칸 점선 진도·끝 표시. 지금 할 과 강조, 준비 안 된 과는 흐리게
function Toc({ data, index, cur, onOpen, titleOf, phone }: { data: HomeData; index: LessonIndex; cur: number; onOpen: (n: number) => void; titleOf: (n: number) => string; phone: boolean }) {
  const allDone = (n: number) => KINDS.every(({ k }) => isDone(data, n, k));
  const doneCount = index.lessons.filter((l) => allDone(l.no)).length;
  const rows = index.lessons.map(({ no: n }) => {
    const ready = index.ready.includes(n), all = ready && allDone(n), isCur = n === cur && !all;
    const nx = ready ? nextKind(data, n) : null;
    return (
      <button key={n} onClick={() => onOpen(n)} className={styles.tocRow} data-cur={isCur} data-ready={ready}>
        <span className={styles.tocN} style={{ color: isCur ? 'var(--accent-ink)' : all ? 'var(--sage-ink)' : 'var(--muted)' }}>{n}</span>
        <span className={styles.tocT} style={{ fontWeight: isCur ? 700 : 600 }}>{titleOf(n)}</span>
        <span className={styles.segs}>
          {KINDS.map(({ k }) => (
            <span key={k} style={{ borderColor: ready && isDone(data, n, k) ? 'var(--sage)' : ready && k === nx ? 'var(--accent)' : 'rgba(140,73,26,.3)' }} />
          ))}
        </span>
        <Mark state={all ? 'done' : isCur ? 'cur' : 'todo'} color={phone ? '#a85c2b' : 'var(--accent)'} />
      </button>
    );
  });
  if (phone)
    return (
      <>
        <div className={styles.mTocHead}><span>목차</span><b>{doneCount} / {index.lessons.length} 완료</b></div>
        {rows}
      </>
    );
  return (
    <div className={styles.tocWrap}>
      <div className={styles.fade} aria-hidden="true" />
      <span className={styles.tocTitle}>목차</span>
      <div className={`${styles.tocList} scroll-hidden`}>{rows}</div>
    </div>
  );
}

function LoadFail({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ font: '700 16px var(--f-body)' }}>불러오지 못했습니다</span>
      <button onClick={onRetry} style={{ padding: '10px 18px', borderRadius: 999, background: 'var(--btn)', color: 'var(--on-accent)', font: '700 14px var(--f-body)' }}>다시 시도</button>
    </div>
  );
}
