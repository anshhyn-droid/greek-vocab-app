'use client';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { recordCompletion } from '@/lib/progress';
import { flyXp } from '@/lib/xpFly';
import { rewardLabel } from '@/lib/reward';

// 요소 폭이 기준(700px) 이상인지. 시안처럼 ResizeObserver로 봄
export function useWide(threshold = 700, observeParent = false) {
  const ref = useRef(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const target = observeParent ? ref.current?.parentElement : ref.current;
    if (!target) return;
    setWide(target.getBoundingClientRect().width >= threshold);
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= threshold));
    ro.observe(target);
    return () => ro.disconnect();
  }, [threshold, observeParent]);
  return [ref, wide];
}

// 폭 값 그대로 (시작·암기 화면)
export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(1080);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(ref.current.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * 학습·암기 완료 기록. 결과 화면으로 넘어가는 순간 save(payload)를 부름
 * 서버가 보상을 계산해 돌려주면 경험치 모션을 띄움
 * @param rootRef 결과 카드가 들어 있는 요소 ([data-xp="src"]를 찾음)
 */
export function useCompletion(rootRef) {
  const [state, setState] = useState({ status: 'idle' });
  const last = useRef(null);
  const timer = useRef(null);

  // payload: { mode, items, durationSec, ox }. 비우면 직전 것을 다시 저장
  const save = useCallback(
    async (payload) => {
      if (payload) last.current = payload;
      setState({ status: 'saving' });
      try {
        const r = await recordCompletion(last.current);
        setState({ status: 'done', result: r });
        timer.current = setTimeout(() => {
          const from = rootRef.current?.querySelector('[data-xp="src"]');
          flyXp(from, r.reward.total, r.xpBefore, r.xpAfter);
        }, 550);
      } catch {
        setState({ status: 'error' });
      }
    },
    [rootRef]
  );
  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setState({ status: 'idle' });
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const r = state.result;
  return {
    ...state,
    save,
    reset,
    retry: () => save(),
    // 통계 칸 "+N" / 설명 줄 "경험치·데나리온 +N (반복 ×0.75 · 복습 +6)"
    rewardShort: r ? '+' + r.reward.total : state.status === 'error' ? '—' : '…',
    coinLabel: '경험치·데나리온 ' + (r ? rewardLabel(r.reward) : state.status === 'error' ? '—' : '…'),
  };
}

// 키보드: 1~4 보기, Enter 다음
export function useKeys(handler) {
  const onKey = useEffectEvent((e) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    handler(e);
  });
  useEffect(() => {
    const on = (e) => onKey(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}
