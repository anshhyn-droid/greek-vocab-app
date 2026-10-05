'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookA, Blocks, Check, ListChecks } from 'lucide-react';
import { Ic } from '@/components/ui';
import { useWide } from '@/components/hooks';
import { loadLessonProgress, clearLessonProgress } from '@/lib/progress';
import { STEPS, STUDY_LESSON, GRAMMAR_PICK } from '@/lib/lesson';

const ROWS = {
  word: { title: '단어', icon: BookA, sub: '뜻을 보며 배운 뒤, 단어만 보고 외웁니다.', count: (n) => `단어 ${n}개 · 배우기·외우기` },
  gram: { title: '문법', icon: ListChecks, sub: '동사의 유형, 태와 법, 현재 능동 어미를 문제로 확인합니다.', count: (n) => `무작위 ${Math.min(GRAMMAR_PICK, n)}문항` },
  sent: { title: '문장', icon: Blocks, sub: '헬라어 문장을 해석 블록으로 풀고, 동사를 원형부터 인칭까지 파싱합니다.', count: (n) => `${n}문장` },
};

export default function LessonMenu() {
  const [rootRef, wide] = useWide();
  const [info, setInfo] = useState(null);
  const done = info?.done || [];

  const read = useCallback(() => loadLessonProgress().then(setInfo).catch(() => {}), []);
  useEffect(() => {
    read();
    window.addEventListener('focus', read);
    return () => window.removeEventListener('focus', read);
  }, [read]);

  const nextKey = STEPS.find((s) => !done.includes(s.key))?.key;

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: wide ? '40px 28px 48px' : '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Link
            href="/start"
            className="press h-tile"
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '7px 14px 7px 10px', borderRadius: 999, border: '1.5px solid var(--line)', font: "700 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}
          >
            <Ic icon={ArrowLeft} size={14} />과 목록
          </Link>
          <span style={{ font: "800 11.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--accent-ink)' }}>성경 헬라어 · 제{STUDY_LESSON}과</span>
          <span style={{ fontFamily: 'var(--f-head)', fontSize: wide ? 36 : 28, lineHeight: 1.15, color: 'var(--ink)', minHeight: '1.15em' }}>{info?.title}</span>
          <span style={{ font: "500 14px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)', maxWidth: 520, wordBreak: 'keep-all', minHeight: '1.6em' }}>{info?.summary}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, height: 10, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: Math.round((done.length / STEPS.length) * 100) + '%', borderRadius: 999, background: 'var(--sage)', transition: 'width .3s' }} />
          </div>
          <span style={{ font: "800 13px 'Figtree',sans-serif", color: 'var(--sage-ink)' }}>{done.length} / {STEPS.length} 완료</span>
          {done.length > 0 && (
            <button
              onClick={() => clearLessonProgress().then(() => setInfo((x) => ({ ...x, done: [] }))).catch(() => {})}
              className="press-card h-ink"
              style={{ cursor: 'pointer', font: "700 12px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}
            >
              기록 지우기
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((s) => {
            const row = ROWS[s.key];
            const isDone = done.includes(s.key);
            const next = s.key === nextKey;
            return (
              <Link
                key={s.key}
                href={s.href}
                className="press-card h-lift"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px 14px 14px', borderRadius: 24,
                  background: isDone ? 'var(--tile-done)' : next ? 'var(--card)' : 'var(--tile)',
                  border: '1.5px solid ' + (isDone ? 'var(--bd-done)' : next ? 'var(--bd-cur)' : 'var(--line)'),
                  color: 'var(--ink)', transition: 'transform .15s, box-shadow .15s', animation: 'pop .22s ease-out',
                }}
              >
                <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDone ? 'var(--sage)' : next ? 'var(--accent)' : 'var(--accent-soft)', color: isDone || next ? 'var(--on-accent)' : 'var(--accent-ink)' }}>
                  <Ic icon={row.icon} size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--f-head)', fontSize: 19, color: 'var(--ink)' }}>{row.title}</span>
                    <span style={{ font: "700 12px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{info ? row.count(info.counts[s.key]) : ''}</span>
                  </div>
                  <span style={{ font: "500 12px/1.5 'Noto Sans KR',sans-serif", color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</span>
                </div>
                {isDone && (
                  <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, background: 'var(--card)', border: '1.5px solid var(--bd-done)', font: "800 11px 'Noto Sans KR',sans-serif", color: 'var(--sage-ink)' }}>
                    <Ic icon={Check} size={12} />완료
                  </span>
                )}
                <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 15px', borderRadius: 999, background: next ? 'var(--btn)' : 'var(--card)', color: next ? 'var(--on-accent)' : 'var(--accent-ink)', font: "800 12.5px 'Noto Sans KR',sans-serif" }}>
                  {isDone ? '다시' : '시작'}
                  <Ic icon={ArrowRight} size={13} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
