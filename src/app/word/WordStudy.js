'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Flame, NotebookPen, PartyPopper, Star, Timer, Volume1, Volume2 } from 'lucide-react';
import { Ic, ExitDialog, LoadError, LoadingCard, Dots, dotStates, ResultStats, SaveError, pillBtn } from '@/components/ui';
import { useWide, useCompletion, useKeys } from '@/components/hooks';
import { api, loadList } from '@/lib/api';
import { shuffle } from '@/lib/shuffle';
import { fmtDuration } from '@/lib/time';
import { nextStepHref } from '@/lib/lesson';

const SHOW_SEC = 1.5; // 배우기: 뜻을 보여주는 시간
const ROUND_NAME = { 1: '배우기', 2: '외우기' };
const ROUND_SUB = { 1: '알맞은 뜻을 고르세요', 2: '뜻 없이 단어만 보고 고르세요' };

export default function WordStudy({ lessonLabel }) {
  const router = useRouter();
  const [rootRef, wide] = useWide(700, true);
  const [words, setWords] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | error | show | quiz | end
  const [round, setRound] = useState(1);
  const [q, setQ] = useState([]); // 남은 단어 (words의 번호)
  const [cleared, setCleared] = useState(0); // 이번 라운드에 한 번에 맞혀 넘긴 수
  const [cl, setCl] = useState([]); // 진행 동그라미: 처음 답한 순서 [{ id, re }]
  const [order, setOrder] = useState([]); // 화면에 보이는 보기 순서
  const [pick, setPick] = useState(null);
  const [wrongs, setWrongs] = useState([]);
  const [flash, setFlash] = useState(null);
  const [sec, setSec] = useState(SHOW_SEC);
  const [note, setNote] = useState({}); // 이번 학습의 오답 노트 { id: { n, ok } }
  const [favs, setFavs] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [time, setTime] = useState(0);
  const [firstTry, setFirstTry] = useState({}); // "id:라운드" → 한 번에 맞혔는지 (처음 출제만)
  const startAt = useRef(0);
  const playTimer = useRef(null);
  const done = useCompletion(rootRef);

  const w = words[q[0]] || words[0];

  const startWord = useCallback((list, queue, r) => {
    const cur = list[queue[0]];
    setPick(null);
    setWrongs([]);
    setFlash(null);
    setOrder(shuffle(cur.ch));
    setSec(r === 2 ? 0 : SHOW_SEC);
    setPhase(r === 2 ? 'quiz' : 'show');
  }, []);

  // 단어를 받아 1라운드 시작 (보기는 요청마다 서버가 새로 만듦)
  const begin = useCallback((list) => {
    const queue = shuffle(list.map((_, i) => i));
    setWords(list);
    setRound(1);
    setQ(queue);
    setCleared(0);
    setCl([]);
    setNote({});
    setFirstTry({});
    startAt.current = Date.now();
    startWord(list, queue, 1);
  }, [startWord]);
  const load = useCallback(() => loadList('/api/words').then(begin, () => setPhase('error')), [begin]);

  useEffect(() => {
    load();
    api('/api/favorites').then(setFavs).catch(() => {});
  }, [load]);
  const restart = () => {
    done.reset();
    setPhase('loading');
    load();
  };

  // 배우기: 1.5초 동안 뜻을 보여준 뒤 퀴즈
  useEffect(() => {
    if (phase !== 'show') return;
    const id = setInterval(() => {
      setSec((s) => {
        const n = Math.round((s - 0.5) * 10) / 10;
        if (n <= 0) setPhase((p) => (p === 'show' ? 'quiz' : p));
        return Math.max(0, n);
      });
    }, 500);
    return () => clearInterval(id);
  }, [phase, q]);

  useEffect(() => () => clearTimeout(playTimer.current), []);

  function answer(t) {
    if (phase !== 'quiz' || pick || wrongs.includes(t)) return;
    if (t === w.m) {
      // 오답 노트(이번 학습): 한 번에 맞히면 ok+1, 2회 연속이면 뺌
      if (!wrongs.length) setNote((n) => {
        const e = n[w.id];
        if (!e) return n;
        const c = { ...n };
        if (e.ok + 1 >= 2) delete c[w.id];
        else c[w.id] = { ...e, ok: e.ok + 1 };
        return c;
      });
      setPick(t);
      return;
    }
    // 오답: 0.5초 빨간색 → 회색 잠금
    setNote((n) => ({ ...n, [w.id]: { n: (n[w.id]?.n || 0) + 1, ok: 0 } }));
    setWrongs((x) => [...x, t]);
    setFlash(t);
    setTimeout(() => setFlash((f) => (f === t ? null : f)), 500);
  }

  function next() {
    const queue = [...q];
    const cur = queue.shift();
    const failed = wrongs.length > 0;
    const key = words[cur].id + ':' + round;
    const ft = key in firstTry ? firstTry : { ...firstTry, [key]: !failed };
    setFirstTry(ft);
    if (failed) queue.push(cur); // 틀린 단어는 맨 뒤로
    const nextCl = cl.some((c) => c.id === words[cur].id) ? cl : [...cl, { id: words[cur].id, re: failed }];
    if (!queue.length) {
      if (round === 1) {
        const q2 = shuffle(words.map((_, i) => i));
        setRound(2);
        setQ(q2);
        setCleared(0);
        setCl([]);
        startWord(words, q2, 2);
        return;
      }
      setCl(nextCl);
      setQ(queue);
      setCleared((c) => c + 1);
      const sec = Math.max(1, Math.round((Date.now() - startAt.current) / 1000));
      setTime(sec);
      setPhase('end');
      done.save({
        mode: 'word',
        durationSec: sec,
        items: Object.entries(ft).map(([k, ok]) => {
          const [id, r] = k.split(':');
          return { id, type: 'word', round: +r, firstTry: ok };
        }),
      });
      return;
    }
    setQ(queue);
    setCl(nextCl);
    if (!failed) setCleared((c) => c + 1);
    startWord(words, queue, round);
  }

  useKeys((e) => {
    if (phase !== 'quiz' || leaveOpen) return;
    if (/^[1-4]$/.test(e.key) && order[+e.key - 1]) answer(order[+e.key - 1]);
    if (e.key === 'Enter' && pick) next();
  });

  const total = words.length * 2;
  const firstOk = Object.values(firstTry).filter(Boolean).length;
  const pct = total ? Math.round((firstOk / total) * 100) : 0;

  const toggleFav = () => {
    if (!w) return;
    const id = w.id;
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    api('/api/favorites', { method: 'POST', body: { itemId: id, itemType: 'word' } }).catch(() =>
      setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
    );
  };
  const playAudio = () => {
    // 소리는 나중에 (콘텐츠 DB의 오디오 주소). 지금은 누를 때 상태만
    clearTimeout(playTimer.current);
    setPlaying(true);
    playTimer.current = setTimeout(() => setPlaying(false), 1100);
  };
  const askLeave = () => (['end', 'loading', 'error'].includes(phase) ? router.push('/') : setLeaveOpen(true));

  const padX = wide ? 28 : 22;
  const dots = dotStates(words.length, cl, w?.id, phase !== 'end');
  const prog = phase === 'end' ? 100 : total ? Math.round((((round - 1) * words.length + cleared) / total) * 100) : 0;
  const noteKeys = Object.keys(note);
  const fav = w && favs.includes(w.id);
  const notePanel = noteKeys.length > 0 && (
    <div style={{ padding: '14px 16px', borderRadius: 20, background: 'var(--tile)', border: '1.5px dashed var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic icon={NotebookPen} size={15} color="var(--muted)" />
        <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' }}>오답 노트</span>
      </div>
      {noteKeys.map((id) => (
        <div key={id} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ flex: 1, fontFamily: 'var(--f-serif)', fontSize: 'calc(15px * var(--gk-scale))', fontWeight: 700, color: 'var(--ink)' }}>{words.find((x) => x.id === id)?.g}</span>
          <span style={{ font: "700 12px 'Noto Sans KR',sans-serif", color: 'var(--wrong-ink)' }}>{note[id].n}회 틀림</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div ref={rootRef} style={{ maxWidth: wide ? 1080 : 640, minHeight: '100vh', margin: '0 auto', paddingTop: 14, paddingBottom: 'env(safe-area-inset-bottom)', position: 'relative', background: 'var(--ground)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
        <ExitDialog open={leaveOpen} onStay={() => setLeaveOpen(false)} onLeave={() => router.push('/')} />

        <div data-xp-anchor="1" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: wide ? '14px 28px 4px' : '10px 22px 4px' }}>
          <button onClick={askLeave} title="과 메뉴로" aria-label="과 메뉴로" className="press-icon h-ink" style={{ color: 'var(--muted)', display: 'inline-flex' }}>
            <Ic icon={ArrowLeft} size={22} />
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: "800 10.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--accent-ink)' }}>{lessonLabel}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--f-head)', fontSize: wide ? 26 : 20, color: 'var(--ink)' }}>단어 · {ROUND_NAME[round]}</span>
              <span style={{ flex: 'none', whiteSpace: 'nowrap', font: "500 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{ROUND_SUB[round]}</span>
            </div>
          </div>
        </div>
        <div style={{ margin: `10px ${padX}px 4px`, height: 9, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: prog + '%', borderRadius: 999, background: 'var(--accent)', transition: 'width .3s' }} />
        </div>
        {!wide && words.length > 0 && (
          <>
            <div style={{ margin: `8px ${padX}px 0` }}>
              <Dots dots={dots} cols={10} gap={5} fontSize={9.5} />
            </div>
            {notePanel && <div style={{ margin: `10px ${padX}px 0` }}>{notePanel}</div>}
          </>
        )}

        <div style={{ flex: 1, minHeight: 0, padding: wide ? '22px 28px 40px' : '18px 22px 24px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {phase === 'loading' && <LoadingCard text="단어를 불러오는 중입니다" />}
            {phase === 'error' && <LoadError onRetry={restart} onMenu={() => router.push('/')} />}

            {(phase === 'show' || phase === 'quiz') && w && (
              <div style={{ position: 'relative', padding: '44px 18px', borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minHeight: 150, justifyContent: 'center' }}>
                <button onClick={playAudio} aria-label="발음 듣기" className="press-icon h-dim" style={{ position: 'absolute', top: 13, left: 14, display: 'inline-flex', color: playing ? 'var(--accent)' : 'var(--muted)', transform: playing ? 'scale(1.18)' : undefined, transition: 'transform .18s, color .18s' }}>
                  <Ic icon={playing ? Volume2 : Volume1} size={20} />
                </button>
                <button onClick={toggleFav} aria-label="즐겨찾기" aria-pressed={!!fav} className="press-card h-dim" style={{ position: 'absolute', top: 13, right: 14, display: 'inline-flex', color: fav ? 'var(--accent)' : 'var(--muted)' }}>
                  <Ic icon={Star} size={20} className={fav ? 'starfill' : ''} />
                </button>
                {phase === 'show' && (
                  <span style={{ position: 'absolute', top: 12, right: 44, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: 'var(--accent-soft)', border: '1.5px solid var(--bd-cur)', color: 'var(--accent-ink)', font: "800 11.5px 'Figtree',sans-serif" }}>
                    <Ic icon={Timer} size={12} />
                    {Math.ceil(sec)}s
                  </span>
                )}
                <span className="gk" style={{ fontSize: 'calc(42px * var(--gk-scale))', lineHeight: 1.1, fontWeight: 700, color: 'var(--ink)' }}>{w.g}</span>
                {phase === 'show' && <span style={{ font: "600 14px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{w.m}</span>}
              </div>
            )}

            {phase === 'quiz' && w && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, animation: 'pop-in .2s ease-out' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {order.map((t) => {
                    const ok = t === w.m && pick === t;
                    const fl = flash === t;
                    const dead = wrongs.includes(t) && !fl;
                    return (
                      <button
                        key={t}
                        onClick={() => answer(t)}
                        disabled={dead}
                        className={'press-card' + (dead || pick ? ' off' : '')}
                        style={{
                          padding: '16px 10px', borderRadius: 20, textAlign: 'center', position: 'relative',
                          transition: 'background .18s, border-color .18s, color .18s, transform .2s var(--spring)',
                          font: "700 14px 'Noto Sans KR',sans-serif",
                          background: ok ? 'var(--tile-done)' : fl ? 'var(--wrong-soft)' : 'var(--tile)',
                          border: '1.5px solid ' + (ok ? 'var(--bd-done)' : fl ? 'var(--wrong)' : 'var(--line)'),
                          color: ok ? 'var(--sage-ink)' : fl ? 'var(--wrong-ink)' : dead ? 'var(--muted)' : 'var(--ink)',
                          opacity: dead ? 0.45 : 1,
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                {pick && (
                  <>
                    <div style={{ padding: '13px 16px', borderRadius: 22, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', font: "400 12.5px/1.6 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>
                      <b style={{ color: 'var(--sage-ink)' }}>정답이에요</b> · <span className="gk" style={{ fontWeight: 700, fontSize: 'calc(1em * var(--gk-scale))' }}>{w.g}</span> — {w.m}
                    </div>
                    <button autoFocus onClick={next} className="press h-btn" style={{ ...pillBtn.primary, padding: 14, font: "800 14px 'Noto Sans KR',sans-serif" }}>다음 단어</button>
                  </>
                )}
              </div>
            )}

            {phase === 'end' && (
              <div style={{ padding: '26px 20px', borderRadius: 26, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', animation: 'pop-in .26s ease-out' }}>
                <Ic icon={PartyPopper} size={30} color="var(--sage)" />
                <span style={{ font: "700 15px 'Noto Sans KR',sans-serif" }}>단어를 모두 맞혔어요</span>
                <span style={{ font: "400 12.5px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>배우기·외우기 두 단계를 모두 통과했습니다 · {done.coinLabel}</span>
                <ResultStats
                  stats={[
                    { k: '정답률', v: pct + '%', fg: pct >= 90 ? 'var(--sage-ink)' : 'var(--ink)' },
                    { k: '소요 시간', v: fmtDuration(time) },
                    { k: '획득 보상', v: done.rewardShort, fg: 'var(--accent-ink)', xp: 'src' },
                  ]}
                />
                <div style={{ marginTop: 2, width: '100%', padding: '14px 16px', borderRadius: 24, background: 'var(--accent-soft)', border: '1.5px solid var(--bd-cur)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Ic icon={Flame} size={24} color="var(--accent)" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
                    <span style={{ font: "800 10.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--accent-ink)' }}>{done.result?.streak.firstToday === false ? '연속 학습' : '연속 학습 갱신'}</span>
                    <span style={{ fontFamily: 'var(--f-head)', fontSize: 19, color: 'var(--ink)' }}>{done.result ? `연속 ${done.result.streak.after}일` : '…'}</span>
                  </div>
                  <span style={{ font: "800 12px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>
                    {done.result ? (done.result.streak.firstToday ? `어제 ${done.result.streak.before}일` : '오늘 이미 기록됨') : ''}
                  </span>
                </div>
                {done.status === 'error' && <SaveError onRetry={done.retry} />}
                <div style={{ marginTop: 12, display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => router.push('/')} className="press h-card" style={{ ...pillBtn.ghost, padding: '12px 20px' }}>과 메뉴</button>
                  <button onClick={restart} className="press h-soft" style={{ ...pillBtn.soft, padding: '12px 20px' }}>다시 하기</button>
                  <button onClick={() => router.push(nextStepHref('word'))} className="press h-btn" style={{ ...pillBtn.primary, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 22px' }}>
                    문법 학습으로<Ic icon={ArrowRight} size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {wide && (
            <div style={{ flex: '0 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 20, borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' }}>단어 진행 · {ROUND_NAME[round]}</span>
                <Dots dots={dots} cols={8} gap={6} fontSize={10.5} />
              </div>
              {notePanel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
