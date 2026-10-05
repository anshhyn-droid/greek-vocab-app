'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, PartyPopper } from 'lucide-react';
import { Ic, ExitDialog, LoadError, LoadingCard, Dots, DotLegend, dotStates, ResultStats, SaveError, GreekText, pillBtn } from '@/components/ui';
import { useWide, useCompletion, useKeys } from '@/components/hooks';
import { loadList } from '@/lib/api';
import { shuffle } from '@/lib/shuffle';
import { fmtDuration } from '@/lib/time';
import { nextStepHref } from '@/lib/lesson';

export default function GrammarStudy({ lesson, title }) {
  const router = useRouter();
  const [rootRef, wide] = useWide();
  const [data, setData] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | error | quiz | end
  const [q, setQ] = useState([]); // 남은 문제 (data의 번호)
  const [order, setOrder] = useState([]); // 화면에 보이는 보기 순서 (엑셀 번호 k)
  const [pick, setPick] = useState(null);
  const [wrongs, setWrongs] = useState([]);
  const [flash, setFlash] = useState(null);
  const [retry, setRetry] = useState([]); // 한 번이라도 틀린 문제 id
  const [missed, setMissed] = useState([]); // 다시 볼 항목 (data 번호)
  const [cleared, setCleared] = useState([]); // 진행 동그라미 [{ id, re }]
  const [doneN, setDoneN] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [time, setTime] = useState(0);
  const startAt = useRef(0);
  const done = useCompletion(rootRef);

  // 보기는 엑셀 번호를 지닌 채 순서만 섞음
  const show = useCallback((list, queue) => {
    setOrder(shuffle(list[queue[0]].o.map((x) => x.k)));
    setPick(null);
    setWrongs([]);
    setFlash(null);
    setPhase('quiz');
  }, []);

  // 서버가 무작위 20문항을 무작위 순서로
  const begin = useCallback((list) => {
    const queue = list.map((_, i) => i);
    setData(list);
    setQ(queue);
    setRetry([]);
    setMissed([]);
    setCleared([]);
    setDoneN(0);
    startAt.current = Date.now();
    show(list, queue);
  }, [show]);
  const load = useCallback(() => loadList('/api/grammar').then(begin, () => setPhase('error')), [begin]);

  useEffect(() => {
    load();
  }, [load]);
  const restart = () => {
    done.reset();
    setPhase('loading');
    load();
  };

  const d = data[q[0]];

  function answer(k) {
    if (phase !== 'quiz' || pick !== null || wrongs.includes(k)) return;
    if (k === d.a) return setPick(k);
    setWrongs((x) => [...x, k]);
    setFlash(k);
    setTimeout(() => setFlash((f) => (f === k ? null : f)), 500);
  }

  function next() {
    const queue = [...q];
    const cur = queue.shift();
    const failed = wrongs.length > 0;
    const id = data[cur].id;
    const nextRetry = failed && !retry.includes(id) ? [...retry, id] : retry;
    if (failed) {
      setRetry(nextRetry);
      if (!missed.includes(cur)) setMissed([...missed, cur]);
      queue.push(cur); // 한 번이라도 틀린 문제는 맨 뒤로
    } else setDoneN((n) => n + 1);
    if (!cleared.some((c) => c.id === id)) setCleared([...cleared, { id, re: failed }]);
    setQ(queue);
    if (!queue.length) {
      const sec = Math.max(1, Math.round((Date.now() - startAt.current) / 1000));
      setTime(sec);
      setPhase('end');
      done.save({ mode: 'gram', durationSec: sec, items: data.map((x) => ({ id: x.id, type: 'gram', firstTry: !nextRetry.includes(x.id) })) });
      return;
    }
    show(data, queue);
  }

  useKeys((e) => {
    if (phase !== 'quiz' || leaveOpen) return;
    if (/^[1-4]$/.test(e.key) && order[+e.key - 1] !== undefined) answer(order[+e.key - 1]);
    if (e.key === 'Enter' && pick !== null) next();
  });

  const n = data.length || 1;
  const firstOk = data.filter((x) => !retry.includes(x.id)).length;
  const pct = Math.round((firstOk / n) * 100);

  const askLeave = () => (['end', 'loading', 'error'].includes(phase) ? router.push('/') : setLeaveOpen(true));
  const padX = wide ? 28 : 16;
  const dots = dotStates(data.length, cleared, d?.id, phase === 'quiz');

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--ground)', color: 'var(--ink)' }}>
      <ExitDialog open={leaveOpen} onStay={() => setLeaveOpen(false)} onLeave={() => router.push('/')} />

      <div data-xp-anchor="1" style={{ maxWidth: 1080, margin: '0 auto', padding: `22px ${padX}px 0`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={askLeave} title="과 메뉴로" aria-label="과 메뉴로" className="press h-tile" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--line)', color: 'var(--muted)' }}>
          <Ic icon={ArrowLeft} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--accent-ink)' }}>제{lesson}과 · 문법</span>
          <span style={{ fontFamily: 'var(--f-head)', fontSize: wide ? 28 : 22, color: 'var(--ink)' }}>{title}</span>
        </div>
      </div>
      <div style={{ maxWidth: 1080, margin: '14px auto 0', padding: `0 ${padX}px` }}>
        <div style={{ height: 9, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: Math.round((doneN / n) * 100) + '%', borderRadius: 999, background: 'var(--accent)', transition: 'width .3s' }} />
        </div>
        {!wide && data.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Dots dots={dots} cols={10} gap={5} fontSize={9.5} />
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: `20px ${padX}px 40px`, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {phase === 'error' && <LoadError onRetry={restart} onMenu={() => router.push('/')} />}
          {phase === 'loading' && <LoadingCard text="문항을 불러오는 중입니다" />}

          {phase === 'quiz' && d && (
            <>
              <div style={{ padding: wide ? '30px 30px 26px' : '20px 18px', borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14, animation: 'pop .2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {d.t && (
                    <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', font: "700 11.5px var(--f-gk-mix)", color: 'var(--sage-ink)' }}>
                      <GreekText text={d.t} />
                    </span>
                  )}
                  {retry.includes(d.id) && (
                    <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--wrong-soft)', font: "700 11px 'Noto Sans KR',sans-serif", color: 'var(--wrong-ink)' }}>다시 풀기</span>
                  )}
                </div>
                <span style={{ font: `600 ${wide ? 21 : 18}px/1.55 var(--f-gk-mix)`, color: 'var(--ink)', textWrap: 'pretty', wordBreak: 'keep-all' }}>
                  <GreekText text={d.p} />
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {order.map((k, pos) => {
                  const ok = k === d.a && pick === k;
                  const fl = flash === k;
                  const dead = wrongs.includes(k) && !fl;
                  const off = dead || pick !== null;
                  return (
                    <button
                      key={k}
                      onClick={() => answer(k)}
                      disabled={dead}
                      className={'press-card h-bright' + (off ? ' off' : '')}
                      style={{
                        position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '17px 18px', borderRadius: 22, textAlign: 'left',
                        transition: 'background .18s, border-color .18s, color .18s, transform .2s var(--spring)',
                        background: ok ? 'var(--tile-done)' : fl ? 'var(--wrong-soft)' : 'var(--tile)',
                        border: '1.5px solid ' + (ok ? 'var(--bd-done)' : fl ? 'var(--wrong)' : 'var(--line)'),
                        color: ok ? 'var(--sage-ink)' : fl ? 'var(--wrong-ink)' : dead ? 'var(--muted)' : 'var(--ink)',
                        opacity: dead ? 0.45 : 1,
                      }}
                    >
                      <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? 'var(--sage)' : fl ? 'var(--wrong)' : 'var(--accent-soft)', font: "800 12.5px 'Figtree',sans-serif", color: ok || fl ? 'var(--on-accent)' : 'var(--accent-ink)' }}>
                        {pos + 1}
                      </span>
                      <span style={{ flex: 1, font: "600 15px/1.5 var(--f-gk-mix)", wordBreak: 'keep-all' }}>
                        <GreekText text={d.o.find((x) => x.k === k).t} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {pick !== null && (
                <>
                  <div style={{ padding: '18px 20px', borderRadius: 24, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', display: 'flex', flexDirection: 'column', gap: 8, animation: 'pop .22s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Ic icon={BookOpen} size={16} color="var(--sage-ink)" />
                      <span style={{ flex: 1, font: "800 13px 'Noto Sans KR',sans-serif", color: 'var(--sage-ink)' }}>
                        {/* N은 섞인 뒤 화면에 보이는 번호 */}
                        {wrongs.length ? `정답은 ${order.indexOf(d.a) + 1}번입니다` : '정답이에요'}
                      </span>
                      {d.pg != null && <span style={{ font: "700 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>교재 {d.pg}쪽</span>}
                    </div>
                    <span style={{ font: "500 14px/1.7 var(--f-gk-mix)", color: 'var(--ink)', wordBreak: 'keep-all' }}>
                      <GreekText text={d.e} />
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button autoFocus onClick={next} className="press h-btn" style={{ ...pillBtn.primary, padding: '14px 30px', font: "800 14px 'Noto Sans KR',sans-serif" }}>
                      {q.length <= 1 && !wrongs.length ? '결과 보기' : '다음 문제'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {phase === 'end' && (
            <div style={{ padding: '34px 30px', borderRadius: 30, background: 'var(--tile-done)', border: '1.5px solid var(--bd-done)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', animation: 'pop .26s ease-out' }}>
              <Ic icon={PartyPopper} size={34} color="var(--sage)" />
              <span style={{ fontFamily: 'var(--f-head)', fontSize: 24, color: 'var(--ink)' }}>문법 문제를 모두 풀었어요</span>
              <span style={{ font: "500 13px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>틀린 문제는 다시 풀어 모두 맞혔습니다 · {done.coinLabel}</span>
              <ResultStats
                big
                maxWidth={520}
                stats={[
                  { k: '한 번에 맞힘', v: pct + '%', fg: pct >= 90 ? 'var(--sage-ink)' : 'var(--ink)' },
                  { k: '소요 시간', v: fmtDuration(time) },
                  { k: '획득 보상', v: done.rewardShort, fg: 'var(--accent-ink)', xp: 'src' },
                ]}
              />
              {missed.length > 0 && (
                <div style={{ marginTop: 6, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                  <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' }}>다시 볼 항목</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {missed.map((i) => (
                      <span key={i} style={{ padding: '6px 13px', borderRadius: 999, background: 'var(--card)', border: '1.5px solid var(--line)', font: "700 12.5px var(--f-gk-mix)", color: 'var(--ink)' }}>
                        <GreekText text={data[i].t || data[i].p} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {done.status === 'error' && <SaveError onRetry={done.retry} />}
              <div style={{ marginTop: 12, display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => router.push('/')} className="press h-card" style={{ ...pillBtn.ghost, padding: '12px 20px' }}>과 메뉴</button>
                <button onClick={restart} className="press h-soft" style={{ ...pillBtn.soft, padding: '12px 20px' }}>다시 하기</button>
                <button onClick={() => router.push(nextStepHref('gram'))} className="press h-btn" style={{ ...pillBtn.primary, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 22px' }}>
                  문장 학습으로<Ic icon={ArrowRight} size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {wide && (
          <div style={{ flex: '0 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 20, borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ font: "800 11px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' }}>문항 진행</span>
              <Dots dots={dots} cols={8} gap={6} fontSize={10.5} />
              <DotLegend />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
