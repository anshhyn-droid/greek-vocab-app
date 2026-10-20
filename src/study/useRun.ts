// 학습·테스트 회차: 시작/이어서 하기, 저장(순서대로, 오래된 저장은 거절됨), 끝내기, 소요 시간(나가 있던 시간은 세지 않음)
import { useCallback, useEffect, useRef } from 'react';
import { api, ApiError } from '../lib/api';

export interface RunState<E = Record<string, unknown>> {
  id: string;
  kind: 'study' | 'test';
  type: string;
  lessons: number[];
  queue: string[];
  itemTotal: number;
  passed: number;
  firstTry: number;
  extra: (E & { seq?: number }) | null;
  elapsedMs: number;
  rev: number;
}

export interface Answer { type: 'word' | 'gram' | 'sent'; id: string; answer: string; passed?: boolean }

export interface FinishResult {
  reward: { total: number; base: number; bonus: number; accuracy: number; multiplier: number; reviewBonus: number };
  itemTotal: number;
  firstTry: number;
  elapsedMs: number;
  xpBefore: number;
  xpAfter: number;
}

export function useRun<E extends Record<string, unknown>>(opts: { kind: 'study' | 'test'; type: string; lessons: number[]; onConflict?: (r: RunState<E>) => void }) {
  const run = useRef<RunState<E> | null>(null);
  const seq = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const active = useRef({ base: 0, since: 0 }); // 소요 시간: 쌓인 값 + 지금 보고 있는 동안
  const onConflict = useRef(opts.onConflict);
  onConflict.current = opts.onConflict;

  const elapsed = () => active.current.base + (active.current.since ? Date.now() - active.current.since : 0);
  useEffect(() => {
    const vis = () => {
      if (document.hidden) {
        if (active.current.since) active.current = { base: elapsed(), since: 0 };
      } else if (!active.current.since && run.current) active.current.since = Date.now();
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  const adopt = (r: RunState<E>) => {
    run.current = r;
    seq.current = Number(r.extra?.seq) || 0;
    active.current = { base: r.elapsedMs, since: document.hidden ? 0 : Date.now() };
  };

  // 새 회차를 만들거나(restart) 이어서 할 회차를 받아 옴
  const start = useCallback(async (init: { queue: string[]; itemTotal: number; extra?: E; options?: unknown }, restart = false) => {
    const r = await api<{ run: RunState<E>; resumed: boolean }>('/api/runs', {
      method: 'POST',
      body: { kind: opts.kind, type: opts.type, lessons: opts.lessons, ...init, restart },
    });
    adopt(r.run);
    return r;
  }, [opts.kind, opts.type, opts.lessons]);

  // 문항이 바뀔 때마다 저장. answers는 이번에 새로 답한 것만
  const save = useCallback((s: { queue: string[]; passed: number; extra: E; answers?: Answer[] }) => {
    const answers = (s.answers || []).map((a) => ({ ...a, seq: ++seq.current, answeredAt: new Date().toISOString() }));
    const extra = { ...s.extra, seq: seq.current };
    const p = chain.current.then(async () => {
      const r = run.current;
      if (!r) return null;
      try {
        const res = await api<{ rev: number; wrongNoted: string[] }>(`/api/runs/${r.id}`, {
          method: 'PUT',
          body: { rev: r.rev, queue: s.queue, passed: s.passed, firstTry: 0, extra, elapsedMs: elapsed(), answers },
        });
        r.rev = res.rev;
        return res;
      } catch (e) {
        // 다른 탭·기기가 더 새로 저장함 → 그 상태로 다시 그림
        if (e instanceof ApiError && e.status === 409 && e.code === 'conflict') {
          const fresh = (e.data as { run: RunState<E> }).run;
          adopt(fresh);
          onConflict.current?.(fresh);
          return null;
        }
        throw e;
      }
    });
    chain.current = p.catch(() => {});
    return p;
  }, []);

  const finish = useCallback(async () => {
    await chain.current;
    const r = run.current!;
    return api<FinishResult>(`/api/runs/${r.id}/finish`, { method: 'POST', body: { elapsedMs: elapsed() } });
  }, []);

  const abandon = useCallback(async () => {
    await chain.current;
    if (run.current?.kind === 'test') await api(`/api/runs/${run.current.id}/abandon`, { method: 'POST' }).catch(() => {});
  }, []);

  return { run, start, save, finish, abandon, elapsed };
}
