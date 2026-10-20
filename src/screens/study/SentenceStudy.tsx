// 문장 학습 (design/Sentence Study.dc.html, design/문장학습_명세.md, steps/step07_sentence.md)
// 왼쪽 쪽: 문장 태그·헬라어 문장·해석 블록 맞추기 / 오른쪽 쪽: 동사 파싱 카드(동사마다)
// 확인 버튼은 하나: 해석 칸에 낱말 1개 이상 + 모든 파싱 줄을 골랐을 때만. 한 번이라도 틀리면 그 문장은 맨 뒤로
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info } from 'lucide-react';
import BookPages from '../../components/book/BookPages';
import { lessonsWithData, loadCodes, loadLesson } from '../../data/content';
import type { Codes, Lesson, Sentence } from '../../data/types';
import { lessonPath } from '../../lib/lessons';
import { useBookSize } from '../../lib/viewport';
import { useBookmarks } from '../../study/bookmarks';
import { useLeaveGuard } from '../../study/leave';
import { BookmarkString, ProgressDots, ResultCard, StudyHeader, fmtTime, rewardLabel, type DotItem } from '../../study/parts';
import { answerOf, axesFor, buildPool, formsByLemma, lemmaOptions, stemsFrom, type Axis, type Block } from '../../study/sentence';
import { useRun, type FinishResult, type RunState } from '../../study/useRun';
import { flyXp, wrongToast } from '../../study/xpFly';
import st from '../../study/study.module.css';
import s from './SentenceStudy.module.css';

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

interface Extra extends Record<string, unknown> { cl: DotItem[]; retry: string[]; done: number }
interface AxState { sel: string | null; ok: boolean; wrong: string[]; fresh: boolean }
type Phase = 'loading' | 'quiz' | 'end' | 'error';

export default function SentenceStudy({ n }: { n: number }) {
  const navigate = useNavigate();
  const { narrow } = useBookSize();
  const bm = useBookmarks();
  const [sents, setSents] = useState<Sentence[]>([]);
  const [codes, setCodes] = useState<Codes | null>(null);
  const ctx = useRef<{ stems: string[]; forms: Map<string, Set<string>> }>({ stems: [], forms: new Map() });
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<string[]>([]);
  const [ex, setEx] = useState<Extra>({ cl: [], retry: [], done: 0 });
  // 지금 문장
  const [pool, setPool] = useState<Block[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const [asm, setAsm] = useState<number[]>([]); // 해석 칸에 넣은 블록(pool 번호)
  const [bad, setBad] = useState<number[]>([]); // 틀려서 잠긴 블록
  const [trOk, setTrOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [axes, setAxes] = useState<Axis[][]>([]);
  const [pw, setPw] = useState<Record<string, AxState>[]>([]);
  const [failed, setFailed] = useState(false);
  const [drag, setDrag] = useState<{ over: boolean; idx: number | null }>({ over: false, idx: null });
  const [result, setResult] = useState<FinishResult | null>(null);
  const noted = useRef(new Set<string>());
  const lineRef = useRef<HTMLDivElement>(null);
  const noClick = useRef(0);
  const run = useRun<Extra>({ kind: 'study', type: 'sent', lessons: [n], onConflict: (r) => adopt(r) });

  const byId = useCallback((id: string) => sents.find((x) => x.id === id), [sents]);
  const cur = byId(q[0]);
  const N = sents.length;

  const present = (id: string | undefined, list: Sentence[], c: Codes) => {
    const sen = list.find((x) => x.id === id);
    if (!sen) return;
    const b = buildPool(sen, ctx.current.stems);
    setPool(b.pool); setTokens(b.tokens); setAsm([]); setBad([]); setTrOk(false); setMsg(null); setFailed(false);
    const ax = sen.parsing.map((p) => axesFor(p, lemmaOptions(p, ctx.current.forms), c, n));
    setAxes(ax);
    setPw(ax.map(() => ({})));
    setPhase('quiz');
  };
  const adopt = (r: RunState<Extra>, list = sents, c = codes) => {
    const e: Extra = { cl: [], retry: [], done: 0, ...(r.extra || {}) } as Extra;
    setEx(e); setQ(r.queue);
    if (c) present(r.queue[0], list, c);
  };

  const begin = useCallback(async (restart = false) => {
    setPhase('loading'); setResult(null); noted.current = new Set();
    try {
      const [l, c, nums] = await Promise.all([loadLesson(n), loadCodes(), lessonsWithData()]);
      const all = await Promise.all(nums.map(loadLesson));
      ctx.current = { stems: stemsFrom(all as Lesson[]), forms: formsByLemma(all as Lesson[]) };
      setSents(l.sentences); setCodes(c);
      // 문장은 매번 무작위 순서
      const r = await run.start({ queue: shuffle(l.sentences.map((x) => x.id)), itemTotal: l.sentences.length, extra: { cl: [], retry: [], done: 0 } }, restart);
      adopt(r.run, l.sentences, c);
    } catch {
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  useEffect(() => { begin(); }, [begin]);

  // ── 해석 블록 ──
  // 빠르게 여러 번 눌러도 직전 상태에서 이어서 (함수형 갱신)
  const put = (pi: number, at: number | null = null) => {
    if (trOk || bad.includes(pi)) return;
    setAsm((cur) => {
      if (cur.includes(pi)) return cur;
      const a = [...cur];
      a.splice(at == null ? a.length : at, 0, pi);
      return a;
    });
    setMsg(null);
  };
  const take = (pos: number) => { if (!trOk) { setAsm((cur) => cur.filter((_, i) => i !== pos)); setMsg(null); } };
  const move = (pos: number, at: number) => {
    if (trOk) return;
    setAsm((cur) => {
      const a = [...cur], [pi] = a.splice(pos, 1);
      a.splice(at > pos ? at - 1 : at, 0, pi);
      return a;
    });
  };
  const inLine = (x: number, y: number) => {
    const r = lineRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8;
  };
  // 놓을 위치: 해석 칸 블록 중 포인터가 가운데보다 왼쪽인 첫 블록 앞
  const slotIndex = (x: number, y: number) => {
    const els = [...(lineRef.current?.querySelectorAll('[data-slot]') || [])];
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return els.length;
  };
  // 끌기: 6px 미만 움직임은 누르기로 처리
  const dragStart = (e: RPointerEvent<HTMLElement>, act: (over: boolean, idx: number | null) => void) => {
    if (trOk || e.button > 0) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const d = { x0: e.clientX, y0: e.clientY, moved: false, ghost: null as HTMLElement | null, idx: null as number | null };
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 6) return;
        d.moved = true;
        const g = el.cloneNode(true) as HTMLElement;
        Object.assign(g.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', zIndex: '90', pointerEvents: 'none', transition: 'none', boxShadow: '0 14px 28px -12px rgba(32,30,29,.5)' });
        document.body.appendChild(g);
        d.ghost = g;
        el.style.opacity = '0.3';
      }
      d.ghost!.style.transform = `translate(${dx}px,${dy}px) scale(1.06) rotate(-2deg)`;
      const over = inLine(ev.clientX, ev.clientY);
      d.idx = over ? slotIndex(ev.clientX, ev.clientY) : null;
      setDrag({ over, idx: d.idx });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!d.moved) return;
      d.ghost?.remove(); el.style.opacity = '';
      noClick.current = Date.now();
      setDrag({ over: false, idx: null });
      act(inLine(ev.clientX, ev.clientY), d.idx);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const clickOk = () => Date.now() - noClick.current > 300;

  // ── 파싱: 고르기만 하고(중립색) 판정은 확인에서 ──
  const pickAx = (vi: number, key: string, code: string) => {
    setPw((all) => {
      const w = all[vi]?.[key] || { sel: null, ok: false, wrong: [], fresh: false };
      if (w.ok || w.wrong.includes(code)) return all;
      return all.map((p, i) => (i !== vi ? p : { ...p, [key]: { ...w, sel: w.sel === code ? null : code, fresh: false } }));
    });
  };
  const axisReady = (vi: number) => axes[vi]?.every((a) => { const w = pw[vi]?.[a.key]; return !!w && (w.ok || w.sel != null); });
  const verbDone = (vi: number) => axes[vi]?.every((a) => pw[vi]?.[a.key]?.ok);
  const allParsed = axes.every((_, i) => axisReady(i));
  const allDone = trOk && axes.every((_, i) => verbDone(i));
  const canCheck = !allDone && (trOk || asm.length > 0) && allParsed;

  const check = () => {
    if (!cur || !canCheck) return;
    let wrongAny = false;
    const nextPw = cur.parsing.map((p, vi) => {
      const o = { ...(pw[vi] || {}) };
      axes[vi].forEach((a) => {
        const w = o[a.key] || { sel: null, ok: false, wrong: [], fresh: false };
        if (w.ok) return;
        if (w.sel === answerOf(p, a.key)) o[a.key] = { ...w, ok: true };
        else { wrongAny = true; o[a.key] = { ...w, wrong: [...w.wrong, w.sel!], sel: null, fresh: true }; }
      });
      return o;
    });
    setPw(nextPw);
    if (!trOk) {
      const wrongBlocks = asm.filter((pi) => !pool[pi].ans), keep = asm.filter((pi) => pool[pi].ans);
      const missing = tokens.length - keep.length;
      if (!wrongBlocks.length && !missing) { setTrOk(true); setMsg(null); }
      else {
        wrongAny = true;
        setAsm(keep); setBad([...bad, ...wrongBlocks]);
        setMsg([wrongBlocks.length ? `맞지 않는 낱말 ${wrongBlocks.length}개를 뺐습니다` : '', missing ? `낱말 ${missing}개가 더 필요합니다` : ''].filter(Boolean).join(' · ') + '. 격과 인칭을 다시 확인해 보세요.');
      }
    }
    if (wrongAny) {
      setFailed(true);
      if (!noted.current.has(cur.id)) { noted.current.add(cur.id); wrongToast(); }
    }
  };

  const next = async () => {
    if (!cur || !allDone) return;
    const rest = q.slice(1);
    if (failed) rest.push(cur.id); // 한 번이라도 틀리면 맨 뒤로
    const e: Extra = {
      done: failed ? ex.done : ex.done + 1,
      retry: failed && !ex.retry.includes(cur.id) ? [...ex.retry, cur.id] : ex.retry,
      cl: ex.cl.some((c) => c.id === cur.id) ? ex.cl : [...ex.cl, { id: cur.id, re: failed }],
    };
    const answers = [{ type: 'sent' as const, id: cur.id, answer: failed ? 'wrong' : 'ok', passed: !failed }];
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
    if (codes) present(rest[0], sents, codes);
    run.save({ queue: rest, passed: e.done, extra: e, answers }).catch(() => {});
  };

  const busy = phase === 'quiz';
  const leave = useLeaveGuard(busy, 'study');
  const back = () => leave.request(() => navigate(lessonPath(n)));
  const count = (phase === 'end' ? N : Math.min(ex.done, N)) + ' / ' + N;

  if (phase === 'error')
    return <BookPages left={<><StudyHeader lesson={n} title="문장" onBack={back} /><p className={s.err}>문장을 불러오지 못했습니다. <button onClick={() => begin()} className={st.soft}>다시 시도</button></p></>} right={null} />;
  if (phase === 'loading' || (!cur && phase !== 'end')) return <BookPages left={<StudyHeader lesson={n} title="문장" onBack={back} />} right={null} />;

  if (phase === 'end') {
    const header = <StudyHeader lesson={n} title="문장" onBack={back} />;
    const card = (
      <ResultCard
        title="문장을 모두 풀었어요"
        sub={<>해석과 동사 파싱을 모두 마쳤습니다 · 경험치·데나리온 {result ? rewardLabel(result.reward) : '…'}</>}
        stats={[
          { k: '한 번에 맞힘', v: result ? `${result.firstTry} / ${result.itemTotal}` : '…', fg: result && result.reward.accuracy >= 90 ? 'var(--sage-ink)' : undefined },
          { k: '소요 시간', v: result ? fmtTime(result.elapsedMs) : '…' },
          { k: '획득 경험치', v: result ? '+' + result.reward.total : '…', fg: 'var(--accent-ink)', xp: true },
        ]}
        actions={[
          { label: '과 메뉴', onClick: () => navigate(lessonPath(n)), kind: 'ghost' },
          { label: '다시 하기', onClick: () => begin(true), kind: 'soft' },
        ]}
      />
    );
    return narrow ? <div className={s.phone}>{header}{card}</div> : <BookPages left={<>{header}<div style={{ marginTop: 24 }}>{card}</div></>} right={<div className={s.endSide}><span className={s.count}>{count}</span></div>} />;
  }

  const sen = cur!;
  const marked = bm.has('sent', sen.id);
  const header = (
    <StudyHeader lesson={n} title="문장" onBack={back} right={narrow ? count : <span className={s.headHint}>해석과 동사 파싱을 모두 맞히면 다음 문장으로 넘어갑니다</span>} />
  );

  const sentenceCard = (
    <div className={narrow ? `${st.sheet} ${s.mSent}` : s.sent}>
      {narrow && <BookmarkString on={marked} onToggle={() => bm.toggle('sent', sen.id)} style={{ top: -1 }} />}
      <div className={s.tags}>
        <span className={s.tag}>제{n}과 {sen.no}번 문장</span>
        {ex.retry.includes(sen.id) && <span className={s.retry}>다시 풀기</span>}
      </div>
      <span className={`gk ${s.greek}`}>{sen.greek}</span>
    </div>
  );

  const translation = (
    <div className={s.box}>
      <div className={s.boxHead}><span style={{ color: trOk ? 'var(--sage-ink)' : undefined }}>해석</span>{trOk && <Check size={16} strokeWidth={2.75} color="var(--sage)" />}</div>
      <div ref={lineRef} className={s.line} data-over={drag.over} data-ok={trOk}>
        {asm.map((pi, pos) => (
          <span key={pi} style={{ display: 'contents' }}>
            {drag.over && drag.idx === pos && <span className={s.gap} />}
            <span
              data-slot="1"
              className={s.slot}
              data-ok={trOk}
              onClick={() => clickOk() && take(pos)}
              onPointerDown={(e) => dragStart(e, (over, idx) => (over ? idx != null && move(pos, idx) : take(pos)))}
            >
              {pool[pi].t}
            </span>
          </span>
        ))}
        {drag.over && drag.idx === asm.length && <span className={s.gap} />}
        {!asm.length && !drag.over && <span className={s.empty}>낱말을 누르거나 끌어다 넣으세요 · 순서는 상관없어요</span>}
      </div>
      {msg && <span className={s.msg}>{msg}</span>}
      {!trOk && (
        <>
          <div className={s.pool}>
            {pool.map((b, pi) => {
              const used = asm.includes(pi), isBad = bad.includes(pi);
              return (
                <span
                  key={pi}
                  className={s.block}
                  data-used={used}
                  data-bad={isBad}
                  onClick={() => clickOk() && put(pi)}
                  onPointerDown={(e) => !used && !isBad && dragStart(e, (over, idx) => over && put(pi, idx))}
                >
                  {b.t}
                </span>
              );
            })}
          </div>
          <div><button onClick={() => { setAsm([]); setMsg(null); }} className={s.clear}>지우기</button></div>
        </>
      )}
    </div>
  );

  const verbs = sen.parsing.map((p, vi) => {
    const lemOk = pw[vi]?.lemma?.ok;
    return (
      <div key={p.id} className={s.box}>
        <div className={s.verbHead}>
          <span className={s.verbTitle} style={{ color: verbDone(vi) ? 'var(--sage-ink)' : undefined }}>동사 파싱</span>
          <span className={`gk ${s.verbForm}`}>{p.form}</span>
          {lemOk && <><span className={`gk ${s.lemma}`}>← {p.lemma}</span><span className={s.mean}>{p.meaning}</span></>}
        </div>
        {(axes[vi] || []).map((a) => {
          const w = pw[vi]?.[a.key] || { sel: null, ok: false, wrong: [], fresh: false };
          return (
            <div key={a.key} className={s.axis}>
              <span className={s.axisK} style={{ color: w.ok ? 'var(--sage-ink)' : undefined }}>{a.k}</span>
              <div className={s.opts}>
                {a.opts.map(([code, t]) => {
                  const ok = w.ok && answerOf(p, a.key) === code, dead = w.wrong.includes(code), isBad = dead && w.fresh, gone = dead && !w.fresh, sel = !w.ok && w.sel === code;
                  return (
                    <button key={code} onClick={() => pickAx(vi, a.key, code)} disabled={w.ok || dead} className={`${s.opt} ${a.greek ? 'gk' : ''}`} data-state={ok ? 'ok' : isBad ? 'bad' : gone ? 'gone' : sel ? 'sel' : ''} data-greek={!!a.greek}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {verbDone(vi) && p.gloss && <div className={s.gloss}><b>해석</b> · {p.gloss}</div>}
      </div>
    );
  });

  const hint = canCheck ? '' : allDone ? '' : !asm.length && !trOk && !allParsed ? '해석과 파싱을 모두 마치면 확인할 수 있어요' : !asm.length && !trOk ? '해석 낱말을 넣으면 확인할 수 있어요' : '파싱을 모두 고르면 확인할 수 있어요';
  const actionBar = allDone ? (
    <div className={s.doneBar}>
      {sen.note && <div className={s.note}><Info size={15} strokeWidth={2.75} color="var(--accent)" /><span>{sen.note}</span></div>}
      <div className={s.barRow}><button onClick={next} className={st.primary} style={{ padding: '13px 28px', fontSize: 15 }}>{q.length <= 1 && !failed ? '결과 보기' : '다음 문장'}</button></div>
    </div>
  ) : (
    <div className={s.checkBar}>
      {hint && <span className={s.hint}>{hint}</span>}
      <button onClick={check} disabled={!canCheck} className={s.check} data-on={canCheck}>확인</button>
    </div>
  );

  if (narrow)
    return (
      <div className={s.phone}>
        {header}
        {sentenceCard}
        {translation}
        {verbs}
        <div className={s.mBar}>{actionBar}</div>
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
            {sentenceCard}
            {translation}
          </div>
        }
        right={
          <div className={s.rightPage}>
            <BookmarkString on={marked} onToggle={() => bm.toggle('sent', sen.id)} style={{ top: -26, right: -24 }} />
            <div className={`${s.verbs} scroll-hidden`}>{verbs}</div>
            {actionBar}
            <div className={s.bottom}>
              <span className={s.progLabel}>문장 진행</span>
              <ProgressDots total={N} cleared={ex.cl} curId={sen.id} live={busy} />
              <span className={s.count}>{count}</span>
            </div>
          </div>
        }
      />
      {leave.dialog}
    </>
  );
}
