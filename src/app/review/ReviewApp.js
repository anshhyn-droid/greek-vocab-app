'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Award, Blocks, BookA, Layers, Layers2, ListChecks, NotebookPen, Star, X } from 'lucide-react';
import { Ic, ResultStats, SaveError, pillBtn } from '@/components/ui';
import { useWidth, useCompletion, useKeys } from '@/components/hooks';
import { api } from '@/lib/api';
import { fmtDuration } from '@/lib/time';
import { LESSON_COUNT } from '@/lib/lesson';

const MODES = [
  { k: 'word', label: '단어', icon: BookA },
  { k: 'gram', label: '문법', icon: ListChecks },
  { k: 'sent', label: '문장', icon: Blocks },
  { k: 'ox', label: 'OX 카드', icon: Layers2 },
];
const KIND = { word: '단어', gram: '문법', sent: '문장', ox: 'OX 카드' };
const card = { borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)' };
const answerOf = (it) => (it.t === 'word' ? it.m : it.ans);
const itemKey = (it) => it.t + ':' + it.id;

export default function ReviewApp() {
  const [rootRef, w] = useWidth();
  const narrow = w < 700;
  const [meta, setMeta] = useState(null);
  const [screen, setScreen] = useState('setup'); // setup | run | done
  // 설정
  const [sel, setSel] = useState([]);
  const [noteOnly, setNoteOnly] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [units, setUnits] = useState([]);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  // 진행
  const [q, setQ] = useState([]);
  const [total, setTotal] = useState(0);
  const [pick, setPick] = useState(null);
  const [wrongs, setWrongs] = useState([]);
  const [flash, setFlash] = useState(null);
  const [failed, setFailed] = useState(false);
  const [ox, setOx] = useState({ dx: 0, drag: false, out: 0, snap: false, show: false, yes: 0, no: 0 });
  const [time, setTime] = useState(0);
  const [firstTry, setFirstTry] = useState({}); // 문항 → { id, type, firstTry } (처음 출제만)
  const startAt = useRef(0);
  const noClick = useRef(-1e9); // OX 카드를 민 시각(이벤트 timeStamp). 바로 뒤 클릭은 무시
  const runMode = useRef('review');
  const oxCount = useRef({ known: 0, unknown: 0 });
  const done = useCompletion(rootRef);
  const markStart = useCallback(() => {
    startAt.current = Date.now();
  }, []);

  const loadMeta = useCallback(() => api('/api/review').then(setMeta).catch(() => {}), []);
  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // ── 설정 ─────────────────────────────────
  // OX·오답 노트는 단독. 단어·문법·문장은 여러 개
  const toggleMode = (k) => {
    if (k === 'ox') setSel(sel.includes('ox') ? [] : ['ox']);
    else {
      const base = sel.filter((x) => x !== 'ox');
      setSel(base.includes(k) ? base.filter((x) => x !== k) : [...base, k]);
    }
    setNoteOnly(false);
    setNoteOpen(false);
  };
  const toggleNote = () => {
    const on = !noteOnly;
    setNoteOnly(on);
    setNoteOpen(on);
    if (on) setSel([]);
  };
  // 과 선택: 누른 과부터 끌어간 과까지 범위로 칠하기 (마우스·터치)
  const unitDown = (e) => {
    const t = e.target.closest?.('[data-n]');
    if (!t) return;
    const n0 = +t.dataset.n;
    const on = !units.includes(n0);
    const base = [...units];
    const paint = (m) => {
      const span = [];
      for (let i = Math.min(n0, m); i <= Math.max(n0, m); i++) span.push(i);
      const next = on ? [...new Set([...base, ...span])] : base.filter((x) => !span.includes(x));
      setUnits(next.sort((a, b) => a - b));
      setShake(false);
    };
    paint(n0);
    const move = (ev) => {
      const c = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-n]');
      if (c) paint(+c.dataset.n);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // 선택한 조건의 문항 수 (서버 문항 수 기준)
  const counts = meta?.counts || {};
  const readyLessons = Object.keys(counts).map(Number);
  const n = noteOnly
    ? meta?.notes.length || 0
    : units.reduce((sum, u) => {
        const c = counts[u];
        if (!c) return sum;
        const pick = (k) => (favOnly ? c['fav' + k[0].toUpperCase() + k.slice(1)] : c[k]);
        return sum + sel.reduce((s2, m) => s2 + (m === 'ox' ? pick('word') : pick(m)), 0);
      }, 0);
  const canStart = noteOnly ? n > 0 : units.length > 0 && sel.length > 0 && n > 0;
  let startLabel = '암기 시작';
  if (!noteOnly && !sel.length) startLabel = '암기 모드를 고르세요';
  else if (!noteOnly && !units.length) startLabel = '암기할 과를 고르세요';
  else if (!n) startLabel = noteOnly ? '오답 노트가 비어 있습니다' : favOnly ? '선택한 과에 즐겨찾기한 문항이 없습니다' : '선택한 과에 아직 문항이 없습니다';
  const modeNames = noteOnly ? '오답 노트' : sel.map((k) => KIND[k]).join(' · ') || '모드 없음';

  async function start() {
    if (!noteOnly && !units.length) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (!canStart || loading) return;
    setLoading(true);
    try {
      const qs = noteOnly ? 'note=1' : `lessons=${units.join(',')}&modes=${sel.join(',')}${favOnly ? '&fav=1' : ''}`;
      const items = await api('/api/review/items?' + qs);
      if (!items.length) return;
      runMode.current = noteOnly ? 'note' : sel.includes('ox') ? 'ox' : 'review';
      oxCount.current = { known: 0, unknown: 0 };
      done.reset();
      setFirstTry({});
      markStart();
      setQ(items);
      setTotal(items.length);
      setOx({ dx: 0, drag: false, out: 0, snap: false, show: false, yes: 0, no: 0 });
      resetItem();
      setScreen('run');
    } catch {
      // 불러오기 실패: 설정 화면에 그대로 둠
    } finally {
      setLoading(false);
    }
  }

  // ── 진행 ─────────────────────────────────
  const it = q[0];
  const resetItem = () => {
    setPick(null);
    setWrongs([]);
    setFlash(null);
    setFailed(false);
  };
  const advance = (wasFailed) => {
    const cur = q[0];
    const key = itemKey(cur);
    const ft = key in firstTry ? firstTry : { ...firstTry, [key]: { id: cur.id, type: cur.t === 'ox' ? 'word' : cur.t, firstTry: !wasFailed } };
    setFirstTry(ft);
    const rest = q.slice(1);
    if (wasFailed) rest.push(cur); // 틀린 문항은 이 회차 마지막에 다시
    setQ(rest);
    resetItem();
    setOx((o) => ({ ...o, dx: 0, show: false }));
    if (!rest.length) {
      const sec = Math.max(1, Math.round((Date.now() - startAt.current) / 1000));
      setTime(sec);
      setScreen('done');
      const mode = runMode.current;
      done.save({ mode, durationSec: sec, items: Object.values(ft), ox: mode === 'ox' ? oxCount.current : undefined });
    }
  };
  const choose = (t) => {
    if (pick !== null || wrongs.includes(t)) return;
    if (t === answerOf(it)) return setPick(t);
    setFailed(true);
    setWrongs((x) => [...x, t]);
    setFlash(t);
    setTimeout(() => setFlash((f) => (f === t ? null : f)), 500);
  };
  // OX: 오른쪽 = 외움, 왼쪽 = 못 외움. 카드가 그 방향으로 밀려 나간 뒤 다음 카드
  const oxDecide = (yes) => {
    if (ox.out) return;
    oxCount.current[yes ? 'known' : 'unknown']++;
    setOx((o) => ({ ...o, out: yes ? 1 : -1, drag: false, [yes ? 'yes' : 'no']: o[yes ? 'yes' : 'no'] + 1 }));
    setTimeout(() => {
      setOx((o) => ({ ...o, out: 0, dx: 0, snap: true, show: false }));
      advance(!yes);
      setTimeout(() => setOx((o) => ({ ...o, snap: false })), 30);
    }, 300);
  };
  const oxDown = (e) => {
    if (ox.out) return;
    const x0 = e.clientX;
    let moved = false;
    let dx = 0;
    const move = (ev) => {
      dx = ev.clientX - x0;
      if (Math.abs(dx) > 5) moved = true;
      setOx((o) => ({ ...o, dx, drag: true }));
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (moved) noClick.current = ev.timeStamp;
      if (Math.abs(dx) > 90) oxDecide(dx > 0);
      else setOx((o) => ({ ...o, dx: 0, drag: false }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  useKeys((e) => {
    if (screen !== 'run' || !it) return;
    if (it.t === 'ox') {
      if (e.key === 'ArrowRight') oxDecide(true);
      if (e.key === 'ArrowLeft') oxDecide(false);
      if (e.key === ' ') {
        e.preventDefault();
        setOx((o) => ({ ...o, show: !o.show }));
      }
      return;
    }
    if (/^[1-4]$/.test(e.key) && it.opts[+e.key - 1]) choose(it.opts[+e.key - 1]);
    if (e.key === 'Enter' && pick !== null) advance(failed);
  });

  const firstOk = Object.values(firstTry).filter((r) => r.firstTry).length;
  const pct = total ? Math.round((firstOk / total) * 100) : 100;

  const pad = narrow ? '24px 16px 40px' : '44px 28px 64px';
  const backToSetup = () => {
    setScreen('setup');
    loadMeta();
  };

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--ink)' }}>
      {screen === 'setup' && (
        <div data-screen-label="암기" style={{ maxWidth: 1080, margin: '0 auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 24, animation: 'pop .3s ease-out' }}>
          <div data-xp-anchor="1" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/start" title="목차로" aria-label="목차로" className="press h-tile" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--line)', color: 'var(--muted)' }}>
              <Ic icon={ArrowLeft} size={18} />
            </Link>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: "800 11.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--accent-ink)' }}>배운 것을 다시</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 900, fontSize: narrow ? 34 : 46, letterSpacing: '-.03em', lineHeight: 1.1, color: 'var(--ink)' }}>암기</span>
                <span style={{ flex: '0 1 auto', minWidth: 0, font: "500 13px 'Noto Sans KR',sans-serif", color: 'var(--muted)', wordBreak: 'keep-all' }}>여러 과를 한번에 설명없이</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ font: "800 10.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' }}>암기 모드</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 9 }}>
                  {MODES.map((m) => {
                    const on = sel.includes(m.k);
                    return (
                      <button key={m.k} onClick={() => toggleMode(m.k)} aria-pressed={on} className="press" style={{ userSelect: 'none', padding: '14px 6px', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, background: on ? 'var(--accent-soft)' : 'var(--tile)', border: '1.5px solid ' + (on ? 'var(--bd-cur)' : 'var(--line)'), color: on ? 'var(--accent-ink)' : 'var(--muted)' }}>
                        <Ic icon={m.icon} size={19} />
                        <span style={{ font: "800 12.5px 'Noto Sans KR',sans-serif", whiteSpace: 'nowrap' }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <span style={{ font: "500 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>단어·문법·문장은 여러 개 고를 수 있고, OX 카드는 단어만 따로 외웁니다</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={toggleNote} aria-pressed={noteOnly} className="press-card" style={{ padding: '16px 18px', borderRadius: 24, background: noteOnly ? 'var(--accent-soft)' : 'var(--card)', border: '1.5px solid ' + (noteOnly ? 'var(--bd-cur)' : 'var(--line)'), display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                  <Ic icon={NotebookPen} size={19} color={noteOnly ? 'var(--accent-ink)' : 'var(--ink)'} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: "800 14px 'Noto Sans KR',sans-serif", color: noteOnly ? 'var(--accent-ink)' : 'var(--ink)' }}>오답 노트</span>
                    <span style={{ font: "500 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{noteOnly ? '오답 노트만 출제합니다 · 과 선택과 상관없이' : '틀린 문항이 모이고, 두 번 연속 맞히면 빠집니다'}</span>
                  </div>
                  <span style={{ font: "800 16px 'Figtree',sans-serif", color: noteOnly ? 'var(--accent-ink)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{meta?.notes.length ?? ''}</span>
                </button>
                {noteOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 6, animation: 'pop .2s ease-out' }}>
                    {meta?.notes.map((nt) => (
                      <div key={nt.id} style={{ padding: '11px 14px', borderRadius: 18, background: 'var(--tile)', border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 34, flex: 'none', font: "700 11px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{KIND[nt.type]}</span>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--f-serif-mix)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nt.label}</span>
                        <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: 'var(--wrong-soft)', color: 'var(--wrong-ink)', font: "800 10.5px 'Noto Sans KR',sans-serif" }}>
                          {nt.wrong}회 틀림{nt.streak ? ` · ${nt.streak}연속` : ''}
                        </span>
                      </div>
                    ))}
                    {!meta?.notes.length && <span style={{ padding: '10px 4px', font: "500 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>오답 노트가 비어 있습니다. 학습과 암기에서 틀린 문항이 여기에 모입니다.</span>}
                  </div>
                )}
              </div>

              <button onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly} className="press-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 20, background: favOnly ? 'var(--accent-soft)' : 'var(--card)', border: '1.5px solid ' + (favOnly ? 'var(--bd-cur)' : 'var(--line)'), color: favOnly ? 'var(--accent-ink)' : 'var(--muted)', textAlign: 'left' }}>
                <Ic icon={Star} size={16} />
                <span style={{ flex: 1, font: "700 13px 'Noto Sans KR',sans-serif" }}>즐겨찾기만 암기</span>
                <span style={{ font: "800 12px 'Figtree',sans-serif" }}>{meta?.favCount ?? ''}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <div style={{ ...card, border: '1.5px solid ' + (shake ? 'var(--accent)' : 'var(--line)'), padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, animation: shake ? 'nudge .35s ease' : 'none', transition: 'border-color .2s' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, font: "800 10.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: shake ? 'var(--accent-ink)' : 'var(--muted)' }}>암기할 과</span>
                  {units.length > 0 && <button onClick={() => setUnits([])} className="h-ink" style={{ cursor: 'pointer', font: "700 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>선택 해제</button>}
                </div>
                <div onPointerDown={unitDown} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 7, touchAction: 'none', userSelect: 'none' }}>
                  {Array.from({ length: LESSON_COUNT }, (_, i) => {
                    const u = i + 1;
                    const on = units.includes(u);
                    return (
                      <div key={u} data-n={u} className="press-unit" style={{ padding: '10px 0', textAlign: 'center', borderRadius: 999, background: on ? 'var(--accent)' : 'var(--tile)', border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line)'), font: "800 12.5px 'Figtree',sans-serif", color: on ? 'var(--on-accent)' : readyLessons.includes(u) ? 'var(--ink)' : 'var(--muted)' }}>
                        {u}
                      </div>
                    );
                  })}
                </div>
                <span style={{ font: "500 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>
                  {noteOnly
                    ? '오답 노트는 과 선택 없이 출제됩니다'
                    : `누른 채로 끌면 처음 과부터 끝 과까지 한 번에 선택됩니다 · 지금은 ${readyLessons.map((x) => '제' + x + '과').join(', ') || '어느 과'}에만 문항이 있습니다`}
                </span>
              </div>

              <div style={{ padding: '18px 20px', borderRadius: 26, background: 'var(--tile)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ic icon={Layers} size={16} color="var(--muted)" />
                  <span style={{ flex: 1, font: "700 13px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>{modeNames} · {n}문항</span>
                </div>
                <button onClick={start} className="press-sm" style={{ padding: 15, borderRadius: 999, textAlign: 'center', background: canStart ? 'var(--btn)' : 'var(--line)', color: canStart ? 'var(--on-accent)' : 'var(--muted)', font: "800 15px 'Noto Sans KR',sans-serif" }}>
                  {loading ? '문항을 불러오는 중' : startLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'run' && it && (
        <div data-screen-label="암기 진행" style={{ maxWidth: 720, margin: '0 auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 18, minHeight: '100vh' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToSetup} title="암기 설정으로" aria-label="암기 설정으로" className="press h-tile" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--line)', color: 'var(--muted)' }}>
              <Ic icon={X} size={18} />
            </button>
            <div style={{ flex: 1, height: 9, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.round(((total - q.length) / Math.max(1, total)) * 100) + '%', borderRadius: 999, background: 'var(--accent)', transition: 'width .3s' }} />
            </div>
            <span style={{ font: "800 12.5px 'Figtree',sans-serif", color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{Math.min(total, total - q.length + 1)} / {total}</span>
          </div>
          <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: it.t === 'ox' ? 'var(--accent-ink)' : 'var(--muted)' }}>{KIND[it.t]}</span>

          {it.t === 'ox' ? (
            <OxCard it={it} ox={ox} setOx={setOx} narrow={narrow} onDown={oxDown} onDecide={oxDecide} noClick={noClick} />
          ) : (
            <>
              <div style={{ ...card, padding: narrow ? '26px 20px' : '34px 30px', display: 'flex', flexDirection: 'column', alignItems: it.t === 'gram' ? 'flex-start' : 'center', gap: 10, textAlign: it.t === 'gram' ? 'left' : 'center', animation: 'pop .2s ease-out' }}>
                <span
                  style={{
                    fontFamily: it.t === 'gram' ? 'var(--f-ui)' : 'var(--f-serif)',
                    fontSize: it.t === 'word' ? `calc(${narrow ? 38 : 48}px * var(--gk-scale))` : it.t === 'sent' ? `calc(${narrow ? 22 : 28}px * var(--gk-scale))` : narrow ? 17 : 20,
                    lineHeight: 1.45, fontWeight: 700, color: 'var(--ink)', wordBreak: 'keep-all', textWrap: 'pretty',
                  }}
                >
                  {it.t === 'gram' ? it.p : it.g}
                </span>
                {it.t === 'gram' && it.sub && <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', font: "700 12px var(--f-serif-mix)", color: 'var(--sage-ink)' }}>{it.sub}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: it.t === 'sent' || narrow ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                {it.opts.map((t) => {
                  const ok = pick === t;
                  const fl = flash === t;
                  const dead = wrongs.includes(t) && !fl;
                  const off = dead || pick !== null;
                  return (
                    <button key={t} onClick={() => choose(t)} disabled={dead} className={'press-card' + (off ? ' off' : '')} style={{ padding: 16, borderRadius: 20, font: "700 14.5px/1.5 var(--f-serif-mix)", wordBreak: 'keep-all', textAlign: 'left', background: ok ? 'var(--tile-done)' : fl ? 'var(--wrong-soft)' : 'var(--tile)', border: '1.5px solid ' + (ok ? 'var(--sage)' : fl ? 'var(--wrong)' : 'var(--line)'), color: ok ? 'var(--sage-ink)' : fl ? 'var(--wrong-ink)' : dead ? 'var(--muted)' : 'var(--ink)', opacity: dead ? 0.45 : 1, transition: 'background .15s, border-color .15s, transform .2s var(--spring)' }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              {pick !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', animation: 'pop .2s ease-out' }}>
                  <span style={{ flex: 1, minWidth: 200, font: "700 13px 'Noto Sans KR',sans-serif", color: failed ? 'var(--wrong-ink)' : 'var(--sage-ink)' }}>{failed ? '다시 나옵니다 · 오답 노트에 담습니다' : '정답이에요'}</span>
                  <button autoFocus onClick={() => advance(failed)} className="press h-btn" style={{ ...pillBtn.primary, padding: '14px 30px', font: "800 14px 'Noto Sans KR',sans-serif" }}>다음</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {screen === 'done' && (
        <div data-screen-label="암기 완료" style={{ maxWidth: 720, margin: '0 auto', padding: pad, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          <div data-xp-anchor="1" style={{ height: 1 }} />
          <div style={{ padding: '34px 28px', borderRadius: 30, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', animation: 'pop .26s ease-out' }}>
            <Ic icon={Award} size={36} color="var(--accent)" />
            <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 900, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>암기를 마쳤습니다</span>
            <span style={{ font: "500 13px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{modeNames} · {fmtDuration(time)} · {done.coinLabel}</span>
            <ResultStats
              big
              maxWidth={480}
              stats={[
                { k: '문항', v: String(total) },
                { k: '한 번에', v: pct + '%', fg: pct >= 90 ? 'var(--sage-ink)' : 'var(--ink)' },
                { k: '획득 보상', v: done.rewardShort, fg: 'var(--accent-ink)', xp: 'src' },
              ]}
            />
            {ox.yes + ox.no > 0 && (
              <div style={{ width: '100%', maxWidth: 480, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 14, borderRadius: 22, background: 'var(--card)', border: '1.5px solid var(--bd-done)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ font: "800 20px 'Figtree',sans-serif", color: 'var(--sage-ink)' }}>{ox.yes}</span>
                  <span style={{ font: "700 11px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>외움</span>
                </div>
                <div style={{ padding: 14, borderRadius: 22, background: 'var(--card)', border: '1.5px solid var(--wrong)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ font: "800 20px 'Figtree',sans-serif", color: 'var(--wrong-ink)' }}>{ox.no}</span>
                  <span style={{ font: "700 11px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>못 외움 · 오답 노트에 담김</span>
                </div>
              </div>
            )}
            {done.status === 'error' && <SaveError onRetry={done.retry} />}
            <div style={{ marginTop: 12, display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/start" className="press" style={{ ...pillBtn.ghost, background: 'var(--card)', padding: '12px 22px' }}>목차로</Link>
              <button onClick={() => { loadMeta(); start(); }} className="press h-btn" style={{ ...pillBtn.primary, padding: '12px 24px' }}>한 번 더 암기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// OX 카드: 헬라어만 → 누르면 뜻. 오른쪽으로 밀면 외움(초록 빛), 왼쪽은 못 외움(빨간 빛)
function OxCard({ it, ox, setOx, narrow, onDown, onDecide, noClick }) {
  const dx = ox.out ? ox.out * 900 : ox.dx;
  const a = Math.min(1, Math.abs(ox.dx) / 110);
  const glowC = ox.dx > 0 ? 'var(--sage)' : 'var(--wrong)';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, paddingBottom: 40 }}>
      {/* 레이아웃 가장자리에서 잘려 사라짐 */}
      <div style={{ clipPath: 'inset(-90px 0 -90px 0)' }}>
        <div
          onPointerDown={onDown}
          onClick={(e) => e.timeStamp - noClick.current > 250 && setOx((o) => ({ ...o, show: !o.show }))}
          style={{
            margin: '0 20px', position: 'relative', touchAction: 'none', cursor: 'grab', userSelect: 'none', minHeight: 280, padding: '54px 24px', borderRadius: 34,
            background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            transform: `translateX(${dx}px) rotate(${dx / 26}deg)`,
            boxShadow: a ? `0 0 ${Math.round(18 + a * 40)}px ${Math.round(a * 10)}px color-mix(in oklab, ${glowC} ${Math.round(a * 65)}%, transparent)` : '0 18px 36px -26px rgba(32,30,29,.5)',
            transition: ox.drag || ox.snap ? 'none' : 'transform .3s cubic-bezier(.4,0,.6,1), box-shadow .2s',
          }}
        >
          <span style={{ position: 'absolute', top: 18, left: 20, padding: '6px 13px', borderRadius: 999, background: 'var(--wrong-soft)', color: 'var(--wrong-ink)', font: "800 12px 'Noto Sans KR',sans-serif", opacity: ox.dx < -36 ? 1 : 0, transition: 'opacity .12s' }}>못 외움</span>
          <span style={{ position: 'absolute', top: 18, right: 20, padding: '6px 13px', borderRadius: 999, background: 'var(--tile-done)', color: 'var(--sage-ink)', font: "800 12px 'Noto Sans KR',sans-serif", opacity: ox.dx > 36 ? 1 : 0, transition: 'opacity .12s' }}>외움</span>
          <span style={{ fontFamily: 'var(--f-serif)', fontSize: `calc(${narrow ? 38 : 52}px * var(--gk-scale))`, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>{it.g}</span>
          {ox.show && <span style={{ position: 'absolute', left: 0, right: 0, top: `calc(50% + ${narrow ? 40 : 52}px)`, textAlign: 'center', font: "700 18px 'Noto Sans KR',sans-serif", color: 'var(--muted)', animation: 'fade-in .18s ease-out' }}>{it.m}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button onClick={() => onDecide(false)} className="press" style={{ padding: '9px 16px', borderRadius: 999, border: '1.5px solid var(--line)', font: "800 12.5px 'Noto Sans KR',sans-serif", color: 'var(--wrong-ink)' }}>← 못 외움</button>
        <span style={{ font: "600 12px 'Noto Sans KR',sans-serif", color: 'var(--muted)', textAlign: 'center' }}>눌러서 뜻 보기 · 좌우로 밀기</span>
        <button onClick={() => onDecide(true)} className="press" style={{ padding: '9px 16px', borderRadius: 999, border: '1.5px solid var(--line)', font: "800 12.5px 'Noto Sans KR',sans-serif", color: 'var(--sage-ink)' }}>외움 →</button>
      </div>
    </div>
  );
}
