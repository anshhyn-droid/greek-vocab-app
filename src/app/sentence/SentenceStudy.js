'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Info, PartyPopper } from 'lucide-react';
import { Ic, ExitDialog, LoadError, LoadingCard, Dots, DotLegend, dotStates, ResultStats, SaveError, pillBtn } from '@/components/ui';
import { useWide, useCompletion } from '@/components/hooks';
import { loadList } from '@/lib/api';
import { fmtDuration } from '@/lib/time';

// 파싱 6줄: 원형 · 시제 · 태 · 법 · 수 · 인칭
const AXES = [
  { key: 'tense', k: '시제', opts: [['PRES', '현재'], ['IMPF', '미완료과거'], ['FUT', '미래'], ['AOR', '부정과거']] },
  { key: 'voice', k: '태', opts: [['ACT', '능동'], ['MID', '중간'], ['PASS', '수동']] },
  { key: 'mood', k: '법', opts: [['IND', '직설법'], ['SUBJ', '가정법'], ['IMPV', '명령법']] },
  { key: 'num', k: '수', opts: [['S', '단수'], ['P', '복수']] },
  { key: 'person', k: '인칭', opts: [['1p', '1인칭'], ['2p', '2인칭'], ['3p', '3인칭']] },
];
const axesFor = (v) => [{ key: 'lemma', k: '원형', greek: true, opts: v.lemOpts.map((l) => [l, l]) }, ...AXES];
const EMPTY_AXIS = { wrong: [], ok: false, sel: null, fresh: false };

export default function SentenceStudy({ lesson }) {
  const router = useRouter();
  const [rootRef, wide] = useWide();
  const lineRef = useRef(null);
  const [data, setData] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | error | quiz | end
  const [q, setQ] = useState([]);
  const [retry, setRetry] = useState([]); // 한 번이라도 틀린 문장 id
  const [cl, setCl] = useState([]); // 진행 동그라미: 푼 순서 [{ id, re }]
  const [doneN, setDoneN] = useState(0);
  // 지금 문장
  const [asm, setAsm] = useState([]); // 해석 칸에 넣은 블록 (koPool 번호)
  const [bad, setBad] = useState([]); // 빼고 잠근 함정 블록
  const [koMsg, setKoMsg] = useState(null);
  const [trOk, setTrOk] = useState(false);
  const [pw, setPw] = useState([]); // 동사별 { 축: { wrong, ok, sel, fresh } }
  const [failed, setFailed] = useState(false);
  const [drag, setDrag] = useState({ over: false, idx: null });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [time, setTime] = useState(0);
  const [firstTry, setFirstTry] = useState({}); // 문장 id → 한 번에 끝냈는지 (처음 출제만)
  const startAt = useRef(0);
  const noClick = useRef(-1e9); // 끌어 놓은 시각(이벤트 timeStamp). 바로 뒤 클릭은 무시
  const done = useCompletion(rootRef);

  const s = data[q[0]];

  const show = useCallback((list, queue) => {
    const cur = list[queue[0]];
    setAsm([]);
    setBad([]);
    setKoMsg(null);
    setTrOk(false);
    setPw(cur.verbs.map(() => ({})));
    setFailed(false);
    setPhase('quiz');
  }, []);

  // 문장 순서·블록·원형 보기는 서버가 매번 섞음
  const begin = useCallback((list) => {
    const queue = list.map((_, i) => i);
    setData(list);
    setQ(queue);
    setRetry([]);
    setCl([]);
    setDoneN(0);
    setFirstTry({});
    startAt.current = Date.now();
    show(list, queue);
  }, [show]);
  const load = useCallback(() => loadList('/api/sentence').then(begin, () => setPhase('error')), [begin]);

  useEffect(() => {
    load();
  }, [load]);
  const restart = () => {
    done.reset();
    setPhase('loading');
    load();
  };

  // ── 해석 블록 ──────────────────────────────
  const tap = (pi, at) => {
    if (trOk || bad.includes(pi) || asm.includes(pi)) return;
    const a = [...asm];
    a.splice(at == null ? a.length : at, 0, pi);
    setAsm(a);
    setKoMsg(null);
  };
  const untap = (pos) => {
    if (trOk) return;
    setAsm(asm.filter((_, i) => i !== pos));
    setKoMsg(null);
  };
  const move = (pos, at) => {
    if (trOk) return;
    const a = [...asm];
    const [pi] = a.splice(pos, 1);
    a.splice(at > pos ? at - 1 : at, 0, pi);
    setAsm(a);
    setKoMsg(null);
  };
  const clickOk = (e) => e.timeStamp - noClick.current > 300;

  const inLine = (x, y) => {
    const r = lineRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8;
  };
  // 놓을 위치: 해석 칸 블록 중 포인터가 가운데보다 왼쪽인 첫 블록 앞
  const slotIndex = (x, y) => {
    const els = [...(lineRef.current?.querySelectorAll('[data-slot]') || [])];
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return els.length;
  };
  // 끌어 놓기: 보기 → 해석 칸에 놓으면 넣기, 해석 칸 → 밖에 놓으면 빼기. 6px 미만은 클릭
  const dragStart = (e, act, can) => {
    if (!can || e.button > 0) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const d = { x0: e.clientX, y0: e.clientY, moved: false, ghost: null, idx: null, over: false };
    const onMove = (ev) => {
      const dx = ev.clientX - d.x0;
      const dy = ev.clientY - d.y0;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 6) return;
        d.moved = true;
        const g = el.cloneNode(true);
        Object.assign(g.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, zIndex: 90, pointerEvents: 'none', opacity: '1', transition: 'none', boxShadow: '0 14px 28px -12px rgba(32,30,29,.5)' });
        document.body.appendChild(g);
        d.ghost = g;
        el.style.opacity = '0.3';
      }
      d.ghost.style.transform = `translate(${dx}px,${dy}px) scale(1.06) rotate(-2deg)`;
      const over = inLine(ev.clientX, ev.clientY);
      const idx = over ? slotIndex(ev.clientX, ev.clientY) : null;
      if (over !== d.over || idx !== d.idx) {
        d.over = over;
        d.idx = idx;
        setDrag({ over, idx });
      }
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!d.moved) return;
      d.ghost.remove();
      el.style.opacity = '';
      noClick.current = ev.timeStamp;
      setDrag({ over: false, idx: null });
      act(inLine(ev.clientX, ev.clientY), d.idx);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // ── 파싱 ───────────────────────────────────
  // 고르기만 하고(중립 색) 정답·오답은 확인 버튼에서 판정. 다시 누르면 선택 해제
  const pickAx = (vi, ax, code) => {
    const cur = pw[vi][ax] || EMPTY_AXIS;
    if (cur.ok || cur.wrong.includes(code)) return;
    setPw(pw.map((p, i) => (i !== vi ? p : { ...p, [ax]: { ...cur, sel: cur.sel === code ? null : code, fresh: false } })));
  };
  const axisReady = (vi) => s && axesFor(s.verbs[vi]).every((a) => { const w = pw[vi]?.[a.key]; return w?.ok || w?.sel != null; });
  const verbDone = (vi) => s && axesFor(s.verbs[vi]).every((a) => pw[vi]?.[a.key]?.ok);

  const koReady = trOk || asm.length > 0;
  const axReady = !!s && s.verbs.every((_, i) => axisReady(i));
  const ready = koReady && axReady;
  const allDone = !!s && trOk && s.verbs.every((_, i) => verbDone(i));

  // 확인: 해석 낱말이 1개 이상 있고 모든 파싱을 골랐을 때만
  function check() {
    if (!ready) return;
    let wrongAny = false;
    // 파싱: 맞은 칸은 잠그고, 틀린 보기는 빨갛게 잠근 채 다시 고르게
    setPw(
      s.verbs.map((v, vi) => {
        const p = { ...(pw[vi] || {}) };
        axesFor(v).forEach((a) => {
          const w = p[a.key] || EMPTY_AXIS;
          if (w.ok) return;
          if (w.sel === v[a.key]) p[a.key] = { ...w, ok: true };
          else {
            wrongAny = true;
            p[a.key] = { ...w, wrong: [...w.wrong, w.sel], sel: null, fresh: true };
          }
        });
        return p;
      })
    );
    if (!trOk) {
      // 해석: 어순은 보지 않음. 정답 낱말이 모두 있고 함정이 없으면 정답
      const wrongBlocks = asm.filter((pi) => !s.koPool[pi].ans);
      const keep = asm.filter((pi) => s.koPool[pi].ans);
      const missing = s.need - keep.length;
      if (!wrongBlocks.length && !missing) {
        setTrOk(true);
        setKoMsg(null);
      } else {
        wrongAny = true;
        // 틀린 블록은 빼고 잠금. 맞게 넣은 블록은 그대로
        const msg = [wrongBlocks.length ? `맞지 않는 낱말 ${wrongBlocks.length}개를 뺐습니다` : '', missing ? `낱말 ${missing}개가 더 필요합니다` : ''].filter(Boolean).join(' · ');
        setAsm(keep);
        setBad([...bad, ...wrongBlocks]);
        setKoMsg(msg + '. 격과 인칭을 다시 확인해 보세요.');
      }
    }
    if (wrongAny) setFailed(true);
  }

  function next() {
    const queue = [...q];
    const cur = queue.shift();
    const ft = s.id in firstTry ? firstTry : { ...firstTry, [s.id]: !failed };
    setFirstTry(ft);
    if (failed) {
      if (!retry.includes(s.id)) setRetry([...retry, s.id]);
      queue.push(cur); // 한 번이라도 틀린 문장은 맨 뒤로
    } else setDoneN((n) => n + 1);
    if (!cl.some((c) => c.id === s.id)) setCl([...cl, { id: s.id, re: failed }]);
    setQ(queue);
    if (!queue.length) {
      const sec = Math.max(1, Math.round((Date.now() - startAt.current) / 1000));
      setTime(sec);
      setPhase('end');
      done.save({ mode: 'sent', durationSec: sec, items: Object.entries(ft).map(([id, ok]) => ({ id, type: 'sent', firstTry: ok })) });
      return;
    }
    show(data, queue);
  }

  const n = data.length || 1;
  const okFirst = Object.values(firstTry).filter(Boolean).length;
  const pct = Math.round((okFirst / n) * 100);

  const askLeave = () => (['end', 'loading', 'error'].includes(phase) ? router.push('/') : setLeaveOpen(true));
  const padX = wide ? 28 : 16;
  const subPad = wide ? '22px 24px' : '18px 16px';
  const dots = dotStates(data.length, cl, s?.id, phase !== 'end');
  const card = { borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)' };
  const block = { touchAction: 'none', userSelect: 'none', padding: '9px 14px', borderRadius: 16, font: "700 14.5px 'Noto Sans KR',sans-serif", transition: 'margin-left .15s ease, transform .2s var(--spring)' };
  const checkHint = ready ? '' : !koReady && !axReady ? '해석과 파싱을 모두 마치면 확인할 수 있어요' : !koReady ? '해석 낱말을 넣으면 확인할 수 있어요' : '파싱을 모두 고르면 확인할 수 있어요';

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--ground)', color: 'var(--ink)' }}>
      <ExitDialog open={leaveOpen} onStay={() => setLeaveOpen(false)} onLeave={() => router.push('/')} />

      <div data-xp-anchor="1" style={{ maxWidth: 1080, margin: '0 auto', padding: `22px ${padX}px 0`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={askLeave} title="과 메뉴로" aria-label="과 메뉴로" className="press h-tile" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--line)', color: 'var(--muted)' }}>
          <Ic icon={ArrowLeft} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--accent-ink)' }}>제{lesson}과 · 문장</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--f-head)', fontSize: wide ? 28 : 22, color: 'var(--ink)' }}>연습 문장</span>
            <span style={{ flex: '0 1 auto', minWidth: 0, wordBreak: 'keep-all', font: "500 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>해석과 동사 파싱을 모두 맞히면 다음 문장으로 넘어갑니다</span>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1080, margin: '14px auto 0', padding: `0 ${padX}px` }}>
        <div style={{ height: 9, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: Math.round((doneN / n) * 100) + '%', borderRadius: 999, background: 'var(--accent)', transition: 'width .3s' }} />
        </div>
        {!wide && data.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Dots dots={dots} size={22} gap={6} fontSize={10} />
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: `20px ${padX}px 40px`, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {phase === 'error' && <LoadError onRetry={restart} onMenu={() => router.push('/')} />}
          {phase === 'loading' && <LoadingCard text="문장을 불러오는 중입니다" />}

          {phase === 'quiz' && s && (
            <>
              <div style={{ ...card, padding: wide ? '28px 30px' : '18px 18px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'pop .2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 999, border: '1.5px solid var(--line)', font: "700 11px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>제{lesson}과 {s.num}번 문장</span>
                  {retry.includes(s.id) && <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--wrong-soft)', font: "700 11px 'Noto Sans KR',sans-serif", color: 'var(--wrong-ink)' }}>다시 풀기</span>}
                </div>
                <span className="gk-serif" style={{ fontSize: `calc(${wide ? 30 : 24}px * var(--gk-scale))`, lineHeight: 1.4, fontWeight: 700, color: 'var(--ink)' }}>{s.g}</span>
              </div>

              {/* 해석 블록 */}
              <div style={{ ...card, padding: subPad, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, font: "800 13px 'Noto Sans KR',sans-serif", color: trOk ? 'var(--sage-ink)' : 'var(--ink)' }}>해석</span>
                  {trOk && <Ic icon={Check} size={16} color="var(--sage)" />}
                </div>
                <div
                  ref={lineRef}
                  style={{
                    minHeight: 58, padding: '12px 14px', borderRadius: 22, transition: 'background .15s, border-color .15s', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                    background: trOk ? 'var(--tile-done)' : drag.over ? 'var(--color-neutral-200)' : 'var(--tile)',
                    border: '1.5px dashed ' + (trOk ? 'var(--bd-done)' : drag.over ? 'var(--color-neutral-500)' : koMsg ? 'var(--wrong)' : 'var(--line)'),
                  }}
                >
                  {asm.map((pi, pos) => (
                    <span
                      key={pi}
                      data-slot="1"
                      onClick={(e) => clickOk(e) && untap(pos)}
                      onPointerDown={(e) => dragStart(e, (over, idx) => (!over ? untap(pos) : idx != null && move(pos, idx)), !trOk)}
                      className={'press-card' + (trOk ? ' off' : '')}
                      style={{
                        ...block, marginLeft: drag.over && drag.idx === pos ? 34 : 0,
                        background: trOk ? 'var(--tile-done)' : 'var(--card)', border: '1.5px solid ' + (trOk ? 'var(--sage)' : 'var(--line)'),
                        color: trOk ? 'var(--sage-ink)' : 'var(--ink)', cursor: trOk ? 'default' : 'grab',
                      }}
                    >
                      {s.koPool[pi].t}
                    </span>
                  ))}
                  {!asm.length && <span style={{ font: "600 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>낱말을 누르거나 끌어다 넣으세요 · 순서는 상관없어요</span>}
                </div>
                {koMsg && <span style={{ font: "700 12.5px 'Noto Sans KR',sans-serif", color: 'var(--wrong-ink)' }}>{koMsg}</span>}
                {!trOk && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {s.koPool.map((b, pi) => {
                        const used = asm.includes(pi);
                        const dead = bad.includes(pi);
                        return (
                          <span
                            key={pi}
                            onClick={(e) => clickOk(e) && tap(pi)}
                            onPointerDown={(e) => dragStart(e, (over, idx) => over && tap(pi, idx), !used && !dead)}
                            className={'press-card h-edge' + (used || dead ? ' off' : '')}
                            style={{ ...block, background: 'var(--card)', border: '1.5px solid var(--line)', color: dead ? 'var(--muted)' : 'var(--ink)', textDecoration: dead ? 'line-through' : 'none', opacity: dead ? 0.45 : used ? 0.3 : 1, cursor: used || dead ? 'default' : 'grab' }}
                          >
                            {b.t}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button onClick={() => { setAsm([]); setKoMsg(null); }} className="press h-tile" style={{ padding: '9px 16px', borderRadius: 999, border: '1.5px solid var(--line)', font: "700 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>지우기</button>
                    </div>
                  </>
                )}
              </div>

              {/* 동사 파싱 (동사마다 카드 1개) */}
              {s.verbs.map((v, vi) => {
                const p = pw[vi] || {};
                const vDone = verbDone(vi);
                return (
                  <div key={v.id} style={{ ...card, padding: subPad, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ font: "800 13px 'Noto Sans KR',sans-serif", color: vDone ? 'var(--sage-ink)' : 'var(--ink)' }}>동사 파싱</span>
                      <span className="gk-serif" style={{ fontSize: 'calc(24px * var(--gk-scale))', fontWeight: 700, color: 'var(--ink)' }}>{v.form}</span>
                      {/* 원형을 맞히기 전에는 기본형과 뜻을 보여주지 않음 */}
                      {p.lemma?.ok && (
                        <>
                          <span className="gk-serif" style={{ fontSize: 'calc(15px * var(--gk-scale))', color: 'var(--muted)' }}>← {v.lemma}</span>
                          <span style={{ font: "600 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{v.mean}</span>
                        </>
                      )}
                    </div>
                    {axesFor(v).map((a) => {
                      const w = p[a.key] || EMPTY_AXIS;
                      return (
                        <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ width: wide ? 40 : '100%', flex: 'none', font: "800 12.5px 'Noto Sans KR',sans-serif", color: w.ok ? 'var(--sage-ink)' : 'var(--ink)' }}>{a.k}</span>
                          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                            {a.opts.map(([code, t]) => {
                              const ok = w.ok && v[a.key] === code;
                              const dead = w.wrong.includes(code);
                              const red = dead && w.fresh; // 확인 직후 틀린 보기
                              const gone = dead && !w.fresh; // 다른 보기를 고르면 회색
                              const sel = !w.ok && w.sel === code;
                              const off = dead || w.ok;
                              return (
                                <button
                                  key={code}
                                  onClick={() => pickAx(vi, a.key, code)}
                                  disabled={off}
                                  className={(a.greek ? 'gk-serif ' : '') + 'press' + (off ? ' off' : '')}
                                  style={{
                                    padding: '8px 15px', borderRadius: 999, fontWeight: 700,
                                    fontSize: a.greek ? 'calc(12.5px * var(--gk-scale))' : 12.5,
                                    fontFamily: a.greek ? 'var(--f-serif)' : 'var(--f-ui)',
                                    background: ok ? 'var(--tile-done)' : red ? 'var(--wrong-soft)' : sel ? 'var(--color-neutral-200)' : 'var(--tile)',
                                    border: '1.5px solid ' + (ok ? 'var(--sage)' : red ? 'var(--wrong)' : sel ? 'var(--color-neutral-500)' : 'var(--line)'),
                                    color: ok ? 'var(--sage-ink)' : red ? 'var(--wrong-ink)' : gone ? 'var(--muted)' : 'var(--ink)',
                                    opacity: red ? 0.75 : gone ? 0.45 : 1,
                                    transition: 'background .15s, border-color .15s, transform .2s var(--spring)',
                                  }}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {vDone && (
                      <div style={{ padding: '12px 16px', borderRadius: 18, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', font: "500 13.5px/1.6 'Noto Sans KR',sans-serif", color: 'var(--ink)', animation: 'pop .2s ease-out' }}>
                        <b style={{ color: 'var(--sage-ink)' }}>해석</b> · {v.gloss}
                      </div>
                    )}
                  </div>
                );
              })}

              {!allDone && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                  {checkHint && <span style={{ font: "600 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{checkHint}</span>}
                  <button
                    onClick={check}
                    disabled={!ready}
                    className={'press' + (ready ? '' : ' off')}
                    style={{ padding: '14px 34px', borderRadius: 999, background: ready ? 'var(--btn)' : 'var(--line)', color: ready ? 'var(--on-accent)' : 'var(--muted)', font: "800 14px 'Noto Sans KR',sans-serif", transition: 'background .2s, transform .2s var(--spring)' }}
                  >
                    확인
                  </button>
                </div>
              )}

              {allDone && (
                <>
                  {s.note && (
                    <div style={{ padding: '14px 18px', borderRadius: 20, background: 'var(--tile)', border: '1.5px solid var(--line)', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <Ic icon={Info} size={15} color="var(--accent)" style={{ marginTop: 3 }} />
                      <span style={{ font: "500 13px/1.6 var(--f-serif-mix)", color: 'var(--ink)' }}>{s.note}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button autoFocus onClick={next} className="press h-btn" style={{ ...pillBtn.primary, padding: '14px 30px', font: "800 14px 'Noto Sans KR',sans-serif", animation: 'pop .2s ease-out' }}>
                      {q.length <= 1 && !failed ? '결과 보기' : '다음 문장'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {phase === 'end' && (
            <div style={{ padding: '34px 30px', borderRadius: 30, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', animation: 'pop .26s ease-out' }}>
              <Ic icon={PartyPopper} size={34} color="var(--sage)" />
              <span style={{ fontFamily: 'var(--f-head)', fontSize: 24, color: 'var(--ink)' }}>문장을 모두 풀었어요</span>
              <span style={{ font: "500 13px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>해석과 동사 파싱을 모두 마쳤습니다 · {done.coinLabel}</span>
              <ResultStats
                big
                maxWidth={520}
                stats={[
                  { k: '한 번에 맞힘', v: pct + '%', fg: pct >= 90 ? 'var(--sage-ink)' : 'var(--ink)' },
                  { k: '소요 시간', v: fmtDuration(time) },
                  { k: '획득 보상', v: done.rewardShort, fg: 'var(--accent-ink)', xp: 'src' },
                ]}
              />
              {done.status === 'error' && <SaveError onRetry={done.retry} />}
              <div style={{ marginTop: 12, display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={restart} className="press h-soft" style={{ ...pillBtn.soft, padding: '12px 20px' }}>다시 하기</button>
                <button onClick={() => router.push('/')} className="press h-btn" style={{ ...pillBtn.primary, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 22px' }}>
                  과 메뉴로<Ic icon={ArrowRight} size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {wide && (
          <div style={{ flex: '0 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' }}>문장 진행</span>
              <Dots dots={dots} size={26} gap={8} fontSize={11} />
              <DotLegend />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
