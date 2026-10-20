// 테스트 풀기: 학습 화면과 같은 틀(왼쪽 문제, 오른쪽 보기·진행)
// 단어: 정답을 고르면 0.65초 뒤 자동으로 다음 / 문법·문장: 다음 버튼 / 문장: 해석 보기 + 파싱 여섯 줄 / 플래시 카드: 뒤집고 앎·모름
// 틀린 문항은 끝에 다시 나오고 오답 노트에 남음. 한 번에 맞힌 문항은 오늘의 목표에 더함(서버). 중간에 나가면 abandoned
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Eye, RotateCcw } from 'lucide-react';
import BookPages from '../../components/book/BookPages';
import { useBookSize } from '../../lib/viewport';
import { useLeaveGuard } from '../../study/leave';
import { ProgressDots, ResultCard, fmtTime, rewardLabel, type DotItem } from '../../study/parts';
import { answerOf, axesFor, formsByLemma, lemmaOptions, type Axis } from '../../study/sentence';
import { useRun, type Answer, type FinishResult } from '../../study/useRun';
import { flyXp, wrongToast } from '../../study/xpFly';
import { KIND, shuffle, typeOf, type Library, type TItem } from './pool';
import st from '../../study/study.module.css';
import s from './Test.module.css';

interface QItem extends TItem { retry?: boolean }

export default function TestRun({ lib, items, kind, name, lessons, onExit }: { lib: Library; items: TItem[]; kind: 'mix' | 'flash'; name: string; lessons: number[]; onExit: () => void }) {
  const { narrow } = useBookSize();
  const [q, setQ] = useState<QItem[]>([]);
  const [phase, setPhase] = useState<'loading' | 'run' | 'end' | 'error'>('loading');
  const [cl, setCl] = useState<DotItem[]>([]); // 처음 답한 순서 (맞음/틀림)
  const [passed, setPassed] = useState(0);
  const [opts, setOpts] = useState<string[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [wrongs, setWrongs] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [parse, setParse] = useState<Record<number, Record<string, string>>>({});
  const [checked, setChecked] = useState(false);
  const [trShown, setTrShown] = useState(false);
  const [flip, setFlip] = useState(false);
  const [dx, setDx] = useState(0);
  const [result, setResult] = useState<FinishResult | null>(null);
  const noted = useRef(new Set<string>());
  const pending = useRef<Answer[]>([]);
  const total = items.length;
  const forms = useMemo(() => formsByLemma([...lib.lessons.values()]), [lib]);
  const run = useRun({ kind: 'test', type: kind, lessons });

  const it = q[0];
  const curRef = useRef<QItem | undefined>(undefined);
  curRef.current = it;
  const key = (x: TItem) => typeOf(x.t) + ':' + x.id;

  // 문항 보이기: 보기를 새로 섞음
  const load = (x: QItem | undefined) => {
    setPick(null); setWrongs([]); setFlash(null); setFailed(false); setParse({}); setChecked(false); setTrShown(false); setFlip(false); setDx(0);
    if (!x) return;
    if (x.t === 'word') {
      const w = lib.word(x.id)!, same = lib.lessons.get(x.lesson)?.words || [];
      setOpts(shuffle([w.meaning, ...shuffle([...new Set(same.filter((o) => o.id !== w.id).map((o) => o.meaning))].filter((m) => m !== w.meaning)).slice(0, 3)]));
    } else if (x.t === 'gram') {
      const g = lib.gram(x.id)!;
      setOpts(shuffle(g.options.filter((o) => o != null && String(o).trim() !== '')));
    } else setOpts([]);
  };

  const begin = async (list: TItem[]) => {
    setPhase('loading'); setResult(null); setCl([]); setPassed(0); noted.current = new Set(); pending.current = [];
    const order = shuffle(list);
    try {
      await run.start({ queue: order.map(key), itemTotal: order.length, extra: {} }, true);
      setQ(order); load(order[0]); setPhase('run');
    } catch { setPhase('error'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { begin(items); }, []);

  const firstResult = (ok: boolean) => {
    if (!it) return;
    if (!ok && !noted.current.has(key(it))) { noted.current.add(key(it)); wrongToast(); }
    setCl((c) => (c.some((x) => x.id === key(it)) ? c : [...c, { id: key(it), re: !ok }]));
  };
  const record = (answer: string) => it && pending.current.push({ type: typeOf(it.t), id: it.id, answer });

  const advance = async (wasFailed: boolean) => {
    if (!it) return;
    const rest = q.slice(1);
    if (wasFailed) rest.push({ ...it, retry: true }); // 틀린 문항은 끝에 다시
    const p = wasFailed ? passed : passed + 1;
    const answers = pending.current; pending.current = [];
    setPassed(p); setQ(rest);
    if (!rest.length) {
      setPhase('end');
      await run.save({ queue: [], passed: total, extra: {}, answers });
      try {
        const r = await run.finish();
        setResult(r);
        setTimeout(() => flyXp(document.querySelector('[data-xp="src"]'), r.reward.total, r.xpBefore, r.xpAfter), 550);
      } catch { setPhase('error'); }
      return;
    }
    load(rest[0]);
    run.save({ queue: rest.map(key), passed: p, extra: {}, answers }).catch(() => {});
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // 단어·문법: 보기 고르기
  const choose = (t: string) => {
    if (!it || pick !== null || wrongs.includes(t)) return;
    const right = it.t === 'word' ? lib.word(it.id)!.meaning : (() => { const g = lib.gram(it.id)!; return g.options[g.answer]; })();
    record(t);
    if (t === right) {
      if (!failed && !wrongs.length) firstResult(true);
      setPick(t);
      // 단어는 0.65초 뒤 자동으로 다음 (그사이 다른 문항으로 바뀌었으면 넘기지 않음)
      if (it.t === 'word') { const cur = it, f = failed; setTimeout(() => { if (curRef.current === cur) advanceRef.current(f); }, 650); }
      return;
    }
    if (!failed) firstResult(false);
    setFailed(true); setWrongs((w) => [...w, t]); setFlash(t);
    setTimeout(() => setFlash((f) => (f === t ? null : f)), 500);
  };

  // 문장: 파싱 여섯 줄 고르고 확인
  const sen = it?.t === 'sent' ? lib.sent(it.id) : undefined;
  const axes: Axis[][] = useMemo(() => (sen ? sen.parsing.map((p) => axesFor(p, lemmaOptions(p, forms), lib.codes, it!.lesson)) : []), [sen, forms, lib.codes, it]);
  const parseReady = !!sen && axes.every((ax, vi) => ax.every((a) => parse[vi]?.[a.key]));
  const check = () => {
    if (!sen || checked || !parseReady) return;
    const ok = sen.parsing.every((p, vi) => axes[vi].every((a) => parse[vi]?.[a.key] === answerOf(p, a.key)));
    record(ok ? 'ok' : 'wrong');
    firstResult(ok);
    setChecked(true); setFailed(!ok); setTrShown(true);
  };

  // 플래시 카드: 앎(→)·모름(←)
  const decide = (yes: boolean) => {
    if (!it || it.t !== 'flash') return;
    record(yes ? lib.word(it.id)!.meaning : 'didnt');
    firstResult(yes);
    setDx(yes ? 900 : -900);
    setTimeout(() => advance(!yes), 280);
  };
  const cardDown = (e: React.PointerEvent) => {
    const x0 = e.clientX; let moved = false;
    const mv = (ev: PointerEvent) => { const d = ev.clientX - x0; if (Math.abs(d) > 5) moved = true; setDx(d); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      const d = ev.clientX - x0;
      if (Math.abs(d) > 90) decide(d > 0); else { setDx(0); if (!moved) setFlip((f) => !f); }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    if (phase !== 'run' || !it) return;
    if (it.t === 'flash') { if (e.key === 'ArrowRight') decide(true); if (e.key === 'ArrowLeft') decide(false); if (e.key === ' ') { e.preventDefault(); setFlip((f) => !f); } return; }
    if (it.t === 'sent') { if (e.key === 'Enter') { if (checked) advance(failed); else check(); } return; }
    if (/^[1-4]$/.test(e.key) && opts[+e.key - 1]) choose(opts[+e.key - 1]);
    if (e.key === 'Enter' && pick !== null && it.t === 'gram') advance(failed);
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const leave = useLeaveGuard(phase === 'run', 'test', () => { run.abandon(); });
  const back = () => leave.request(() => { if (phase === 'run') run.abandon(); onExit(); });
  const count = Math.min(passed, total) + ' / ' + total;
  const header = (
    <div className={s.runHead}>
      <button onClick={back} title="뒤로" className={st.back}><ArrowLeft size={17} strokeWidth={2.75} /></button>
      <span className={s.runT}>테스트</span>
      <span className={st.hBar} />
      <span className={s.runName}>{name}</span>
      {narrow && phase === 'run' && <span className={s.runCount}>{count}</span>}
    </div>
  );

  if (phase === 'error') return <BookPages left={<>{header}<p style={{ marginTop: 24 }}>테스트를 시작하지 못했습니다. <button onClick={() => begin(items)} className={st.soft}>다시 시도</button></p></>} right={null} />;
  if (phase === 'loading') return <BookPages left={header} right={null} />;
  if (phase === 'end') {
    const card = (
      <ResultCard
        title="테스트를 마쳤어요"
        sub={<>{name} · {total}문항 · 경험치·데나리온 {result ? rewardLabel(result.reward) : '…'}</>}
        stats={[
          { k: '한 번에 맞힘', v: result ? `${result.firstTry} / ${result.itemTotal}` : '…', fg: result && result.reward.accuracy >= 90 ? 'var(--sage-ink)' : undefined },
          { k: '소요 시간', v: result ? fmtTime(result.elapsedMs) : '…' },
          { k: '획득 경험치', v: result ? '+' + result.reward.total : '…', fg: 'var(--accent-ink)', xp: true },
        ]}
        actions={[
          { label: '테스트 처음으로', onClick: onExit, kind: 'ghost' },
          { label: '다시 하기', onClick: () => begin(items), kind: 'soft' },
        ]}
      />
    );
    return narrow ? <div className={s.phone}>{header}{card}</div> : <BookPages left={<>{header}<div style={{ marginTop: 24 }}>{card}</div></>} right={null} />;
  }

  const kindTag = it && (
    <div className={s.qTags}>
      <span className={s.tag}>{KIND[it.t]} · 제{it.lesson}과</span>
      {it.retry && <span className={s.retry}>다시 풀기</span>}
    </div>
  );

  // ── 문제(왼쪽 쪽) ──
  let question: React.ReactNode = null, answerSide: React.ReactNode = null;
  if (it?.t === 'word' || it?.t === 'gram') {
    const isW = it.t === 'word', g = !isW ? lib.gram(it.id) : null;
    question = (
      <div className={narrow ? `${st.sheet} ${s.qSheet}` : s.q} data-center={isW}>
        {kindTag}
        {isW ? <span className={`gk ${s.word}`}>{lib.word(it.id)?.greek}</span> : <><span className={s.prompt}>{g?.prompt}</span>{g?.target && <span className={`gk ${s.target}`}>{g.target}</span>}</>}
      </div>
    );
    answerSide = (
      <div className={s.ansCol}>
        <div className={s.choices} data-phone={narrow} data-word={isW}>
          {opts.map((t, i) => {
            const ok = pick === t, bad = flash === t, dead = wrongs.includes(t) && !bad;
            return (
              <button key={t + i} onClick={() => choose(t)} disabled={pick !== null || dead} className={s.choice} data-state={ok ? 'ok' : bad ? 'bad' : dead ? 'dead' : ''}>
                <span className={s.num}>{i + 1}</span><span className={s.cText}>{t}</span>
              </button>
            );
          })}
        </div>
        {/* 다음 버튼 자리 (단어는 자동으로 넘어감) */}
        <div className={s.slot} style={{ visibility: pick !== null ? 'visible' : 'hidden' }}>
          <span className={s.verdict} data-bad={failed}>{failed ? '끝에 다시 나와요 · 오답 노트에 담았습니다' : '정답이에요'}</span>
          {!isW && <button onClick={() => advance(failed)} className={st.primary} style={{ padding: '10px 24px' }}>{q.length <= 1 && !failed ? '결과 보기' : '다음 문제'}</button>}
        </div>
        {!isW && pick !== null && g?.explanation && <span className={s.explain}>{g.explanation}</span>}
        {!isW && pick === null && <span className={s.explain} style={{ visibility: 'hidden' }}>.</span>}
      </div>
    );
  } else if (it?.t === 'sent' && sen) {
    question = (
      <div className={narrow ? `${st.sheet} ${s.qSheet}` : s.q}>
        {kindTag}
        <span className={`gk ${s.sentence}`}>{sen.greek}</span>
        <button onClick={() => setTrShown((v) => !v)} className={s.trBtn} data-on={trShown}><Eye size={15} strokeWidth={2.75} />{trShown ? sen.translation : '해석 보기'}</button>
      </div>
    );
    answerSide = (
      <div className={s.ansCol} style={{ justifyContent: 'flex-start' }}>
        <div className={`${s.verbs} scroll-hidden`}>
          {sen.parsing.map((p, vi) => (
            <div key={p.id} className={s.verb}>
              <div className={s.verbHead}><span>동사 파싱</span><b className="gk">{p.form}</b>{checked && <span className="gk" style={{ color: 'var(--muted)' }}>← {p.lemma} · {p.meaning}</span>}</div>
              {axes[vi].map((a) => (
                <div key={a.key} className={s.axis}>
                  <span className={s.axisK}>{a.k}</span>
                  <div className={s.opts}>
                    {a.opts.map(([code, label]) => {
                      const sel = parse[vi]?.[a.key] === code, right = answerOf(p, a.key) === code;
                      const state = checked ? (right ? 'ok' : sel ? 'bad' : 'dim') : sel ? 'sel' : '';
                      return (
                        <button key={code} disabled={checked} onClick={() => setParse((pp) => ({ ...pp, [vi]: { ...(pp[vi] || {}), [a.key]: pp[vi]?.[a.key] === code ? '' : code } }))} className={`${s.opt} ${a.greek ? 'gk' : ''}`} data-state={state}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {checked && p.gloss && <div className={s.gloss}><b>해석</b> · {p.gloss}</div>}
            </div>
          ))}
        </div>
        <div className={s.sentBar}>
          {checked ? (
            <>
              <span className={s.verdict} data-bad={failed}>{failed ? '초록색이 정답입니다 · 끝에 다시 나오고 오답 노트에 담았습니다' : '파싱이 맞았어요'}</span>
              <button onClick={() => advance(failed)} className={st.primary} style={{ padding: '11px 24px' }}>{q.length <= 1 && !failed ? '결과 보기' : '다음 문제'}</button>
            </>
          ) : (
            <>
              {!parseReady && <span className={s.hint}>항목마다 하나씩 고르세요</span>}
              <button onClick={check} disabled={!parseReady} className={s.check} data-on={parseReady}>확인</button>
            </>
          )}
        </div>
      </div>
    );
  } else if (it?.t === 'flash') {
    const w = lib.word(it.id)!;
    const a = Math.min(1, Math.abs(dx) / 110), glow = dx > 0 ? '122,138,94' : '192,69,58';
    question = (
      <div className={s.flashWrap}>
        {kindTag}
        <div
          onPointerDown={cardDown}
          className={s.card}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 26}deg)`, transition: Math.abs(dx) >= 900 || dx === 0 ? 'transform .3s cubic-bezier(.4,0,.6,1)' : 'none', boxShadow: a ? `0 0 ${Math.round(18 + a * 40)}px ${Math.round(a * 10)}px rgba(${glow},${(a * 0.55).toFixed(2)})` : undefined }}
        >
          <span className={`gk ${s.flashWord}`}>{w.greek}</span>
          <span className={s.flashMean} style={{ visibility: flip ? 'visible' : 'hidden' }}>{w.meaning}</span>
          <span className={s.flashHint}>{flip ? '알았으면 오른쪽, 몰랐으면 왼쪽으로 넘기세요' : '눌러서 뒤집기'}</span>
          <span className={s.swipeNo} style={{ opacity: dx < -36 ? 1 : 0 }}>모름</span>
          <span className={s.swipeYes} style={{ opacity: dx > 36 ? 1 : 0 }}>앎</span>
        </div>
      </div>
    );
    answerSide = (
      <div className={s.ansCol}>
        <div className={s.flashBtns}>
          <button onClick={() => decide(false)} className={s.no}><RotateCcw size={16} strokeWidth={2.75} />모름</button>
          <button onClick={() => decide(true)} className={s.yes}><BookOpen size={16} strokeWidth={2.75} />앎</button>
        </div>
        <span className={s.flashKeys}>← 모름 · 앎 → · 스페이스로 뒤집기</span>
      </div>
    );
  }

  if (narrow)
    return (
      <div className={s.phone}>
        {header}
        {question}
        {answerSide}
        {leave.dialog}
      </div>
    );
  return (
    <>
      <BookPages
        leftPad="26px 36px 28px 22px"
        rightPad="26px 22px 28px 36px"
        left={<div className={s.runLeft}><div className={s.top}>{header}</div>{question}</div>}
        right={
          <div className={s.runRight}>
            <div className={s.top} />
            {answerSide}
            <div className={s.bottom}>
              <span className={s.progLabel}>문항 진행</span>
              <ProgressDots total={total} cleared={cl} curId={it ? key(it) : null} live />
              <span className={s.count}>{count}</span>
            </div>
          </div>
        }
      />
      {leave.dialog}
    </>
  );
}
