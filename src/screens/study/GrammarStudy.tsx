// 문법 학습 (design/Grammar Study.dc.html, steps/step06_grammar.md)
// 시작: 개념 정리(두 쪽에 개념 표, 나란한 표끼리 높이 맞춤, 진행 표시 없음) → "문제 풀기" → grammarLearning 전부
// "개념 보기": 왼쪽 쪽 아래 빈 곳에 개념 표가 펼쳐짐. 책갈피: 문제(gram)·개념 표(concept, L03-1)
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark, Table2, X } from 'lucide-react';
import BookPages from '../../components/book/BookPages';
import ConceptSection from '../../components/ConceptSection';
import { loadLesson, lessonCode } from '../../data/content';
import type { ConceptSection as Section, GrammarItem } from '../../data/types';
import { lessonPath, studyPath } from '../../lib/lessons';
import { useBookSize } from '../../lib/viewport';
import { useBookmarks } from '../../study/bookmarks';
import { useLeaveGuard } from '../../study/leave';
import { BookmarkString, ProgressDots, ResultCard, StudyHeader, fmtTime, rewardLabel, type DotItem } from '../../study/parts';
import { useRun, type Answer, type FinishResult, type RunState } from '../../study/useRun';
import { flyXp, wrongToast } from '../../study/xpFly';
import st from '../../study/study.module.css';
import s from './GrammarStudy.module.css';

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

interface Extra extends Record<string, unknown> { cl: DotItem[]; retry: string[]; done: number; started: boolean }
type Phase = 'loading' | 'intro' | 'quiz' | 'end' | 'error';

export default function GrammarStudy({ n }: { n: number }) {
  const navigate = useNavigate();
  const { narrow } = useBookSize();
  const bm = useBookmarks();
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<string[]>([]);
  const [ex, setEx] = useState<Extra>({ cl: [], retry: [], done: 0, started: false });
  const [order, setOrder] = useState<number[]>([]); // 보기 원래 번호(0~3)를 섞은 순서
  const [pick, setPick] = useState<number | null>(null);
  const [wrongs, setWrongs] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const pending = useRef<Answer[]>([]);
  const noted = useRef(new Set<string>());
  const run = useRun<Extra>({ kind: 'study', type: 'gram', lessons: [n], onConflict: (r) => adopt(r) });

  const byId = useCallback((id: string) => items.find((x) => x.id === id), [items]);
  const cur = byId(q[0]);
  const N = items.length;

  const present = (id: string | undefined, list: GrammarItem[]) => {
    const it = list.find((x) => x.id === id);
    if (!it) return;
    setPick(null); setWrongs([]); setFlash(null);
    setOrder(shuffle(it.options.map((_, i) => i).filter((i) => it.options[i] != null && String(it.options[i]).trim() !== '')));
  };
  const adopt = (r: RunState<Extra>, list = items) => {
    const e: Extra = { cl: [], retry: [], done: 0, started: false, ...(r.extra || {}) } as Extra;
    setEx(e); setQ(r.queue);
    // 처음이면 개념 정리부터, 이어서 하면 문제부터
    if (e.started) { setPhase('quiz'); present(r.queue[0], list); } else setPhase('intro');
  };

  const begin = useCallback(async (restart = false) => {
    setPhase('loading'); setResult(null); setPeek(false); noted.current = new Set(); pending.current = [];
    try {
      const l = await loadLesson(n);
      setItems(l.grammarLearning); setSections(l.concepts.sections);
      const r = await run.start({ queue: shuffle(l.grammarLearning.map((x) => x.id)), itemTotal: l.grammarLearning.length, extra: { cl: [], retry: [], done: 0, started: false } }, restart);
      adopt(r.run, l.grammarLearning);
    } catch {
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  useEffect(() => { begin(); }, [begin]);

  const startQuiz = () => {
    const e = { ...ex, started: true };
    setEx(e); setPhase('quiz'); present(q[0], items);
    run.save({ queue: q, passed: e.done, extra: e }).catch(() => {});
  };

  const answer = (i: number) => {
    if (!cur || pick !== null || wrongs.includes(i) || phase !== 'quiz') return;
    const right = i === cur.answer;
    pending.current.push({ type: 'gram', id: cur.id, answer: cur.options[i], passed: right && !wrongs.length });
    if (right) { setPick(i); return; }
    if (!noted.current.has(cur.id)) { noted.current.add(cur.id); wrongToast(); }
    setWrongs((w) => [...w, i]); setFlash(i);
    setTimeout(() => setFlash((f) => (f === i ? null : f)), 500);
  };

  const next = async () => {
    if (!cur || pick === null) return;
    const rest = q.slice(1), failed = wrongs.length > 0;
    if (failed) rest.push(cur.id); // 틀린 문항은 회차 끝에 다시
    const e: Extra = {
      ...ex,
      done: failed ? ex.done : ex.done + 1,
      retry: failed && !ex.retry.includes(cur.id) ? [...ex.retry, cur.id] : ex.retry,
      cl: ex.cl.some((c) => c.id === cur.id) ? ex.cl : [...ex.cl, { id: cur.id, re: failed }],
    };
    const answers = pending.current; pending.current = [];
    setEx(e); setQ(rest);
    if (!rest.length) {
      setPhase('end');
      await run.save({ queue: [], passed: N, extra: e, answers });
      try {
        const r = await run.finish();
        setResult(r);
        setTimeout(() => flyXp(document.querySelector('[data-xp="src"]'), r.reward.total, r.xpBefore, r.xpAfter), 550);
      } catch { setPhase('error'); }
      return;
    }
    present(rest[0], items);
    run.save({ queue: rest, passed: e.done, extra: e, answers }).catch(() => {});
  };

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    if (peek && e.key === 'Escape') return setPeek(false);
    if (phase !== 'quiz') return;
    if (/^[1-4]$/.test(e.key) && order[+e.key - 1] !== undefined) answer(order[+e.key - 1]);
    if (e.key === 'Enter' && pick !== null) next();
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const busy = phase === 'quiz';
  const leave = useLeaveGuard(busy, 'study');
  const back = () => leave.request(() => navigate(lessonPath(n)));
  const count = (phase === 'end' ? N : Math.min(ex.done, N)) + ' / ' + N;
  const conceptId = (i: number) => `${lessonCode(n)}-${i + 1}`;

  if (phase === 'error')
    return <BookPages left={<><StudyHeader lesson={n} title="문법" onBack={back} /><p className={s.err}>문제를 불러오지 못했습니다. <button onClick={() => begin()} className={st.soft}>다시 시도</button></p></>} right={null} />;
  if (phase === 'loading') return <BookPages left={<StudyHeader lesson={n} title="문법" onBack={back} />} right={null} />;

  // ── 개념 정리 ──
  if (phase === 'intro') {
    const header = <StudyHeader lesson={n} title="문법 정리" onBack={back} />;
    const go = <button onClick={startQuiz} className={`${st.primary} ${s.go}`}>문제 풀기<ArrowRight size={14} strokeWidth={2.75} /></button>;
    const card = (sec: Section, i: number) => (
      <ConceptCard key={i} section={sec} on={bm.has('concept', conceptId(i))} onMark={() => bm.toggle('concept', conceptId(i))} />
    );
    if (narrow)
      return (
        <div className={s.phone}>
          {header}
          {sections.map(card)}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{go}</div>
        </div>
      );
    return <ConceptSpread header={header} button={go} sections={sections} render={card} />;
  }

  // ── 결과 ──
  if (phase === 'end') {
    const card = (
      <ResultCard
        title="문법 문제를 모두 풀었어요"
        sub={<>틀린 문항은 오답 노트에 담겼어요 · 경험치·데나리온 {result ? rewardLabel(result.reward) : '…'}</>}
        stats={[
          { k: '한 번에 맞힘', v: result ? `${result.firstTry} / ${result.itemTotal}` : '…', fg: result && result.reward.accuracy >= 90 ? 'var(--sage-ink)' : undefined },
          { k: '소요 시간', v: result ? fmtTime(result.elapsedMs) : '…' },
          { k: '획득 경험치', v: result ? '+' + result.reward.total : '…', fg: 'var(--accent-ink)', xp: true },
        ]}
        actions={[
          { label: '과 메뉴', onClick: () => navigate(lessonPath(n)), kind: 'ghost' },
          { label: '다시 하기', onClick: () => begin(true), kind: 'soft' },
          { label: '문장 학습으로', onClick: () => navigate(studyPath(n, 'sent')), kind: 'primary' },
        ]}
      />
    );
    const header = <StudyHeader lesson={n} title="문법" onBack={back} />;
    return narrow ? <div className={s.phone}>{header}{card}</div> : <BookPages left={<>{header}<div style={{ marginTop: 24 }}>{card}</div></>} right={<div className={s.endSide}><span className={s.count}>{count}</span></div>} />;
  }

  // ── 문제 ──
  const marked = cur ? bm.has('gram', cur.id) : false;
  const header = (
    <StudyHeader
      lesson={n}
      title="문법"
      onBack={back}
      right={
        <span className={s.headRight}>
          {narrow && <span>{count}</span>}
          <button onClick={() => setPeek((p) => !p)} className={s.peekBtn} aria-expanded={peek}><Table2 size={13} strokeWidth={2.75} />개념 보기</button>
        </span>
      }
    />
  );
  const problem = cur && (
    <div className={narrow ? `${st.sheet} ${s.mCard}` : s.problem}>
      {narrow && <BookmarkString on={marked} onToggle={() => bm.toggle('gram', cur.id)} style={{ top: -1 }} />}
      <div className={s.retryRow}>{ex.retry.includes(cur.id) && <span className={s.retry}>다시 풀기</span>}</div>
      <span className={s.prompt}>{cur.prompt}</span>
      {cur.target && <span className={`${s.target} gk`}>{cur.target}</span>}
    </div>
  );
  const choices = cur && (
    <div className={s.choices} data-phone={narrow}>
      {order.map((i, pos) => {
        const ok = pick === i, bad = flash === i, dead = wrongs.includes(i) && !bad;
        return (
          <button key={i} onClick={() => answer(i)} className={s.choice} data-state={ok ? 'ok' : bad ? 'bad' : dead ? 'dead' : ''} disabled={pick !== null || dead}>
            <span className={s.num}>{pos + 1}</span>
            <span className={s.cText}>{cur.options[i]}</span>
          </button>
        );
      })}
    </div>
  );
  const verdict = cur && (wrongs.length ? `정답은 ${order.indexOf(cur.answer) + 1}번입니다` : '정답이에요');
  const explain = cur && (
    <div className={s.explainArea} style={{ visibility: pick !== null ? 'visible' : 'hidden' }}>
      <div className={s.explain}>
        <div className={s.verdict}><BookOpen size={16} strokeWidth={2.75} /><span>{verdict}</span></div>
        {cur.explanation && <span className={s.expText}>{cur.explanation}</span>}
      </div>
      <div className={s.nextRow}>
        <button onClick={next} className={st.primary} style={{ padding: '12px 28px', fontSize: 15 }}>{q.length <= 1 && !wrongs.length ? '결과 보기' : '다음 문제'}</button>
      </div>
    </div>
  );
  const conceptPanel = peek && (
    <div className={s.peek}>
      <div className={s.peekHead}><Table2 size={15} strokeWidth={2.75} /><span>개념</span><button onClick={() => setPeek(false)} title="닫기"><X size={15} strokeWidth={2.75} /></button></div>
      <div className={`${s.peekBody} scroll-hidden`}>
        {sections.map((sec, i) => <ConceptCard key={i} section={sec} small on={bm.has('concept', conceptId(i))} onMark={() => bm.toggle('concept', conceptId(i))} />)}
      </div>
    </div>
  );

  if (narrow)
    return (
      <div className={s.phone}>
        {header}
        {conceptPanel}
        {problem}
        {choices}
        {explain}
        {leave.dialog}
      </div>
    );

  return (
    <>
      <BookPages
        leftPad="26px 36px 28px 22px"
        rightPad="26px 22px 28px 36px"
        left={
          <div className={s.leftPage}>
            <div className={s.top}>{header}</div>
            {problem}
            {conceptPanel}
          </div>
        }
        right={
          <div className={s.rightPage}>
            {cur && <BookmarkString on={marked} onToggle={() => bm.toggle('gram', cur.id)} style={{ top: -26, right: -24 }} />}
            <div className={s.top} />
            <div className={s.mid}>
              {choices}
              {explain}
            </div>
            <div className={s.bottom}>
              <span className={s.progLabel}>문항 진행</span>
              <ProgressDots total={N} cleared={ex.cl} curId={cur?.id ?? null} live={busy} />
              <span className={s.count}>{count}</span>
            </div>
          </div>
        }
      />
      {leave.dialog}
    </>
  );
}

// 개념 표 한 묶음 + 책갈피
function ConceptCard({ section, on, onMark, small }: { section: Section; on: boolean; onMark: () => void; small?: boolean }) {
  return (
    <div className={small ? s.cardSmall : s.card}>
      <button onClick={onMark} title="책갈피" aria-pressed={on} className={s.mark} style={{ color: on ? 'var(--accent)' : 'var(--muted)' }}>
        <Bookmark size={20} strokeWidth={2.75} fill={on ? 'currentColor' : 'none'} />
      </button>
      <ConceptSection section={{ ...section, title: section.title || '개요' }} />
    </div>
  );
}

// 개념 정리: 묶음을 두 쪽에 번갈아 싣고, 나란히 놓인 두 칸의 높이를 맞춤. 넘치면 쪽 안에서 스크롤
function ConceptSpread({ header, button, sections, render }: { header: React.ReactNode; button: React.ReactNode; sections: Section[]; render: (s: Section, i: number) => React.ReactNode }) {
  const left = sections.map((x, i) => [x, i] as const).filter(([, i]) => i % 2 === 0);
  const right = sections.map((x, i) => [x, i] as const).filter(([, i]) => i % 2 === 1);
  const L = useRef<HTMLDivElement>(null), R = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const a = [...(L.current?.children || [])] as HTMLElement[], b = [...(R.current?.children || [])] as HTMLElement[];
      [...a, ...b].forEach((el) => (el.style.minHeight = ''));
      a.forEach((el, i) => { const o = b[i]; if (!o) return; const h = Math.max(el.offsetHeight, o.offsetHeight) + 'px'; el.style.minHeight = h; o.style.minHeight = h; });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (L.current) ro.observe(L.current);
    return () => ro.disconnect();
  }, [sections]);
  return (
    <BookPages
      leftPad="26px 36px 28px 22px"
      rightPad="26px 22px 28px 36px"
      left={<div className={s.intro}><div className={s.top}>{header}</div><div ref={L} className={s.col}>{left.map(([x, i]) => render(x, i))}</div></div>}
      right={<div className={s.intro}><div className={s.top} style={{ justifyContent: 'flex-end' }}>{button}</div><div ref={R} className={s.col}>{right.map(([x, i]) => render(x, i))}</div></div>}
    />
  );
}
