// 학습 홈 값 (서버 /api/home) + 지금 할 과 계산
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { loadLessonIndex } from '../data/content';
import type { LessonIndex } from '../data/types';

export type Kind = 'word' | 'gram' | 'sent';
export const KINDS: { k: Kind; label: string }[] = [
  { k: 'word', label: '단어' },
  { k: 'gram', label: '문법' },
  { k: 'sent', label: '문장' },
];

export interface HomeData {
  today: string;
  goal: Record<Kind, number>;
  done: Record<Kind, number>;
  progress: Record<number, Partial<Record<Kind, string>>>;
  runs: { lesson: number; type: Kind; at: number; of: number; updatedAt: string }[];
}

export function useHome() {
  const [data, setData] = useState<HomeData | null>(null);
  const [index, setIndex] = useState<LessonIndex | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    setError(false);
    return Promise.all([api<HomeData>('/api/home'), loadLessonIndex()])
      .then(([d, i]) => { setData(d); setIndex(i); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  // 빠르게 여러 번 눌러도 직전 값에서 이어서 바뀌도록 (k, ±1)
  const stepGoal = useCallback((k: Kind, d: number) => {
    setData((cur) => {
      if (!cur) return cur;
      const goal = { ...cur.goal, [k]: Math.max(0, Math.min(50, cur.goal[k] + d)) };
      api('/api/goals', { method: 'PATCH', body: goal }).catch(() => reload());
      return { ...cur, goal }; // 막대·숫자를 바로 바꿈
    });
  }, [reload]);
  return { data, index, error, reload, stepGoal };
}

export const isDone = (d: HomeData, n: number, k: Kind) => d.progress[n]?.[k] === 'done';
export const runOf = (d: HomeData, n: number, k: Kind) => d.runs.find((r) => r.lesson === n && r.type === k);

// 지금 할 과: 이어서 하던 과 → 아직 다 못 끝낸 첫 과 → 첫 과
export function currentLesson(d: HomeData, ready: number[]): number {
  const r = d.runs.find((x) => ready.includes(x.lesson));
  if (r) return r.lesson;
  return ready.find((n) => !KINDS.every(({ k }) => isDone(d, n, k))) ?? ready[0];
}

// 그 과에서 이어서 할 학습: 하던 것 → 안 끝낸 첫 것
export function nextKind(d: HomeData, n: number): Kind | null {
  return runOf(d, n, 'word') ? 'word' : runOf(d, n, 'gram') ? 'gram' : runOf(d, n, 'sent') ? 'sent' : KINDS.find(({ k }) => !isDone(d, n, k))?.k ?? null;
}
