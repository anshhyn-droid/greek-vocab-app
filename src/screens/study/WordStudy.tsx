// 단어 학습 (design/Word Study.dc.html, steps/step05_word.md)
// 단어 보여 주기 → 보기 고르기. 1바퀴(배우기): 뜻을 1.5초 보여 준 뒤 / 2바퀴(외우기): 뜻 없이
// 틀린 단어는 그 바퀴 끝에 다시 나옴. 진행 N = 완전히 통과한 문항
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, Timer } from 'lucide-react';
import BookPages from '../../components/book/BookPages';
import { loadLesson } from '../../data/content';
import type { Word } from '../../data/types';
import { lessonPath, studyPath } from '../../lib/lessons';
import { useBookSize } from '../../lib/viewport';
import { useBookmarks } from '../../study/bookmarks';
import { useLeaveGuard } from '../../study/leave';
import { BookmarkString, ProgressDots, ResultCard, StudyHeader, fmtTime, rewardLabel, type DotItem } from '../../study/parts';
import { useRun, type Answer, type FinishResult, type RunState } from '../../study/useRun';
import { flyXp, wrongToast } from '../../study/xpFly';
import st from '../../study/study.module.css';
import s from './WordStudy.module.css';

const SHOW_MS = 1500;
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

interface Extra extends Record<string, unknown> { round: 1 | 2; cleared: number; cl: DotItem[]; miss: number; noted: string[] }
type Phase = 'loading' | 'show' | 'quiz' | 'end' | 'error';

export default function WordStudy({ n }: { n: number }) {
  const navigate = useNavigate();
  const { narrow } = useBookSize();
  const bm = useBookmarks();
  const [words, setWords] = useState<Word[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<string[]>([]); // 이번 바퀴에 남은 단어 id
  const [ex, setEx] = useState<Extra>({ round: 1, cleared: 0, cl: [], miss: 0, noted: [] });
  const [sec, setSec] = useState(0); // 보여 주기 남은 시간
  const [order, setOrder] = useState<string[]>([]); // 보기 4개
  const [pick, setPick] = useState<string | null>(null);
  const [wrongs, setWrongs] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<FinishResult | null>(null);
  const pendingAnswers = useRef<Answer[]>([]);
  const seenThisRun = useRef(new Set<string>()); // 오답 노트 알림: 한 회차에 한 문항 한 번
  const timer = useRef<number | undefined>(undefined);

  const run = useRun<Extra>({ kind: 'study', type: 'word', lessons: [n], onConflict: (r) => adoptRun(r) });
  const byId = useCallback((id: string) => words.find((w) => w.id === id), [words]);
  const N = words.length, TOT = N * 2;

  // 보기: 정답 뜻 + 같은 과 다른 단어 뜻 3개
  const choicesFor = useCallback((w: Word, list: Word[]) => shuffle([w.meaning, ...shuffle([...new Set(list.filter((x) => x.id !== w.id).map((x) => x.meaning))].filter((m) => m !== w.meaning)).slice(0, 3)]), []);

  const present = useCallback((id: string | undefined, round: 1 | 2, list: Word[]) => {
    clearInterval(timer.current);
    const w = list.find((x) => x.id === id);
    if (!w) return;
    setPick(null); setWrongs([]); setFlash(null);
    setOrder(choicesFor(w, list));
    if (round === 2) { setPhase('quiz'); setSec(0); return; }
    setPhase('show'); setSec(SHOW_MS);
    const end = Date.now() + SHOW_MS;
    timer.current = window.setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) { clearInterval(timer.current); setSec(0); setPhase((p) => (p === 'show' ? 'quiz' : p)); } else setSec(left);
    }, 100);
  }, [choicesFor]);

  const adoptRun = (r: RunState<Extra>, list = words) => {
    const e: Extra = { round: 1, cleared: 0, cl: [], miss: 0, noted: [], ...(r.extra || {}) } as Extra;
    e.noted.forEach((id) => seenThisRun.current.add(id));
    setEx(e); setQ(r.queue);
    present(r.queue[0], e.round, list);
  };

  const begin = useCallback(async (restart = false) => {
    setPhase('loading'); setResult(null); seenThisRun.current = new Set(); pendingAnswers.current = [];
    try {
      const l = await loadLesson(n);
      const list = l.words;
      setWords(list);
      const queue = shuffle(list.map((w) => w.id));
      const r = await run.start({ queue, itemTotal: list.length * 2, extra: { round: 1, cleared: 0, cl: [], miss: 0, noted: [] } }, restart);
      adoptRun(r.run, list);
    } catch {
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  useEffect(() => { begin(); return () => clearInterval(timer.current); }, [begin]);

  const cur = byId(q[0]);
  const itemKey = (id: string) => (ex.round === 2 ? id + '#2' : id);

  const answer = (t: string) => {
    if (!cur || pick || wrongs.includes(t) || phase !== 'quiz') return;
    const right = t === cur.meaning;
    pendingAnswers.current.push({ type: 'word', id: itemKey(cur.id), answer: t, passed: right && !wrongs.length });
    if (right) { clearInterval(timer.current); setPick(t); return; }
    if (!seenThisRun.current.has(cur.id)) { seenThisRun.current.add(cur.id); wrongToast(); setEx((e) => ({ ...e, noted: [...e.noted, cur.id] })); }
    setWrongs((w) => [...w, t]); setFlash(t); setEx((e) => ({ ...e, miss: e.miss + 1 }));
    setTimeout(() => setFlash((f) => (f === t ? null : f)), 500);
  };

  const next = async () => {
    if (!cur || !pick) return;
    const rest = q.slice(1), failed = wrongs.length > 0;
    if (failed) rest.push(cur.id); // 틀린 문항은 회차 끝에 다시
    const cleared = failed ? ex.cleared : ex.cleared + 1;
    const cl = ex.cl.some((c) => c.id === cur.id) ? ex.cl : [...ex.cl, { id: cur.id, re: failed }];
    const answers = pendingAnswers.current; pendingAnswers.current = [];
    let e: Extra = { ...ex, cleared, cl }, queue = rest;
    if (!rest.length && ex.round === 1) { e = { ...e, round: 2, cleared: 0, cl: [] }; queue = shuffle(words.map((w) => w.id)); }
    const passed = (e.round - 1) * N + e.cleared;
    if (!rest.length && ex.round === 2) {
      // 끝: 마지막 답을 저장하고 결과
      setEx(e); setQ([]); setPhase('end');
      await run.save({ queue: [], passed: TOT, extra: e, answers });
      try {
        const r = await run.finish();
        setResult(r);
        setTimeout(() => flyXp(document.querySelector('[data-xp="src"]'), r.reward.total, r.xpBefore, r.xpAfter), 550);
      } catch { setPhase('error'); }
      return;
    }
    setEx(e); setQ(queue);
    present(queue[0], e.round, words);
    run.save({ queue, passed, extra: e, answers }).catch(() => {});
  };

  // 키보드: 1~4 보기, Enter 다음
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    if (/^[1-4]$/.test(e.key) && order[+e.key - 1]) answer(order[+e.key - 1]);
    if (e.key === 'Enter' && pick) next();
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const busy = phase === 'show' || phase === 'quiz';
  const leave = useLeaveGuard(busy, 'study');
  const back = () => leave.request(() => navigate(lessonPath(n)));

  const count = (phase === 'end' ? TOT : Math.min((ex.round - 1) * N + ex.cleared, TOT)) + ' / ' + TOT;
  const roundName = ex.round === 2 ? '외우기' : '배우기';
  const header = <StudyHeader lesson={n} title={`단어 · ${roundName}`} onBack={back} right={narrow && phase !== 'end' ? count : undefined} />;
  const marked = cur ? bm.has('word', cur.id) : false;
  const toggleMark = () => cur && bm.toggle('word', cur.id);

  if (phase === 'error')
    return <BookPages left={<>{header}<p className={s.err}>문제를 불러오지 못했습니다. <button onClick={() => begin()} className={st.soft}>다시 시도</button></p></>} right={null} />;

  if (phase === 'end') {
    const card = (
      <ResultCard
        title="단어를 모두 맞혔어요"
        sub={<>배우기·외우기 두 단계를 모두 통과했습니다 · 경험치·데나리온 {result ? rewardLabel(result.reward) : '…'}</>}
        stats={[
          { k: '한 번에 맞힘', v: result ? `${result.firstTry} / ${result.itemTotal}` : '…', fg: result && result.reward.accuracy >= 90 ? 'var(--sage-ink)' : undefined },
          { k: '소요 시간', v: result ? fmtTime(result.elapsedMs) : '…' },
          { k: '획득 경험치', v: result ? '+' + result.reward.total : '…', fg: 'var(--accent-ink)', xp: true },
        ]}
        actions={[
          { label: '과 메뉴', onClick: () => navigate(lessonPath(n)), kind: 'ghost' },
          { label: '다시 하기', onClick: () => begin(true), kind: 'soft' },
          { label: '문법 학습으로', onClick: () => navigate(studyPath(n, 'gram')), kind: 'primary' },
        ]}
      />
    );
    return narrow ? <div className={s.phone}>{header}{card}</div> : <BookPages left={<>{header}<div className={s.endWrap}>{card}</div></>} right={<div className={s.endSide}><span className={s.count}>{count}</span></div>} />;
  }

  const ready = !!cur && phase !== 'loading';
  const timerBadge = (
    <span className={s.timer} style={{ visibility: phase === 'show' ? 'visible' : 'hidden' }}>
      <Timer size={12} strokeWidth={2.75} />{(Math.ceil(sec / 100) / 10).toFixed(1)}s
    </span>
  );
  const word = (
    <span className={s.wordWrap}>
      {timerBadge}
      <span className={`gk ${s.word}`}>{ready ? cur!.greek : ' '}</span>
    </span>
  );
  const meaning = <span className={s.meaning} style={{ visibility: phase === 'show' ? 'visible' : 'hidden' }}>{cur?.meaning || ' '}</span>;
  const choices = (
    <div className={s.choices} data-phone={narrow} style={{ visibility: phase === 'quiz' ? 'visible' : 'hidden' }}>
      {order.map((t, i) => {
        const ok = pick === t, isFlash = flash === t, dead = wrongs.includes(t) && !isFlash;
        return (
          <button key={t + i} onClick={() => answer(t)} className={s.choice} data-state={ok ? 'ok' : isFlash ? 'bad' : dead ? 'dead' : ''} disabled={!!pick || dead}>
            <span className={s.num}>{i + 1}</span>
            <span className={s.cText}>{t}</span>
          </button>
        );
      })}
    </div>
  );
  const slot = (
    <div className={s.slot} style={{ visibility: pick ? 'visible' : 'hidden' }}>
      <span className={s.okText}><b>정답이에요</b> · {cur?.meaning}</span>
      <button onClick={next} className={st.primary} style={{ padding: '10px 24px', fontSize: 15 }}>다음 단어</button>
    </div>
  );

  if (narrow)
    return (
      <div className={s.phone}>
        {header}
        {ex.noted.length > 0 && (
          <div className={s.noteBox}>
            <div className={s.noteHead}><NotebookPen size={15} strokeWidth={2.75} /><span>오답 노트</span></div>
            {ex.noted.map((id) => <div key={id} className={s.noteRow}><span className="gk">{byId(id)?.greek}</span></div>)}
          </div>
        )}
        <div className={`${st.sheet} ${s.mCard}`}>
          <BookmarkString on={marked} onToggle={toggleMark} style={{ top: -1 }} />
          {word}
          {meaning}
        </div>
        {choices}
        {slot}
        {leave.dialog}
      </div>
    );

  return (
    <>
      <BookPages
        leftPad="26px 36px 28px 22px"
        rightPad="26px 22px 28px 36px"
        left={
          <div className={s.page}>
            <div className={s.top}>{header}</div>
            <div className={s.mid}>
              {word}
              {meaning}
            </div>
            <div className={s.bottom}><span className={s.pageNo}>{Math.min(TOT, (ex.round - 1) * N + ex.cleared + 1)}</span></div>
          </div>
        }
        right={
          <div className={s.page}>
            <BookmarkString on={marked} onToggle={toggleMark} style={{ top: -26, right: -24 }} />
            <div className={s.top} />
            <div className={s.mid}>
              <div className={s.qCol}>
                {choices}
                {slot}
              </div>
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
