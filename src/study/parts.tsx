// 학습 화면 공통 조각: 머리줄, 책갈피 끈, 진행 점, 결과 칸
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, PartyPopper } from 'lucide-react';
import s from './study.module.css';

// 왼쪽 쪽 맨 위: ← 뒤로 + "3과 | 단어" (과 번호는 제목 글꼴·테라코타)
export function StudyHeader({ lesson, title, onBack, right }: { lesson: number; title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className={s.header}>
      <button onClick={onBack} title="뒤로" className={s.back}><ArrowLeft size={17} strokeWidth={2.75} /></button>
      <span className={s.hLesson}>{lesson}과</span>
      <span className={s.hBar} />
      <span className={s.hTitle}>{title}</span>
      {right && <span className={s.hRight}>{right}</span>}
    </div>
  );
}

// 책갈피 끈: 누르면 길어지고 진해지며 저장. 누르는 범위는 끈보다 넓게(좌우 40px, 아래 24px)
export function BookmarkString({ on, onToggle, style }: { on: boolean; onToggle: () => void; style?: React.CSSProperties }) {
  return (
    <>
      <button onClick={onToggle} title="책갈피" aria-pressed={on} className={s.string} style={style}>
        <span style={{ height: on ? 88 : 58, background: on ? '#a85c2b' : '#d9c2a2' }} />
      </button>
      <span className={s.stringHint} style={style ? { top: 12 + (Number(style.top) || 0), right: 76 + (Number(style.right) || 0) } : undefined}>{on ? '책갈피에 담았어요' : '끈을 내리면 책갈피에 담겨요'}</span>
    </>
  );
}

// 진행 점: 처음 답한 순서로 칠함(맞음 세이지, 틀림 빨강), 지금 문항은 주황 테두리
export interface DotItem { id: string; re: boolean }
export function ProgressDots({ total, cleared, curId, live }: { total: number; cleared: DotItem[]; curId: string | null; live: boolean }) {
  const seen = cleared.some((c) => c.id === curId);
  return (
    <div className={s.dots}>
      {Array.from({ length: total }, (_, i) => {
        const c = cleared[i];
        const now = live && (c ? c.id === curId : !seen && i === cleared.length);
        const bg = now ? 'transparent' : c ? (c.re ? 'var(--wrong)' : 'var(--sage)') : 'transparent';
        const bd = now ? 'var(--accent)' : c ? (c.re ? 'var(--wrong)' : 'var(--sage)') : 'var(--line)';
        return <span key={i} style={{ background: bg, boxShadow: `inset 0 0 0 1.5px ${bd}` }} />;
      })}
    </div>
  );
}

export interface Stat { k: string; v: string; fg?: string; xp?: boolean }
// 결과: 소요 시간·한 번에 맞힌 수·경험치 + 버튼들
export function ResultCard({ title, sub, stats, actions }: { title: string; sub: ReactNode; stats: Stat[]; actions: { label: string; onClick: () => void; kind: 'ghost' | 'soft' | 'primary' }[] }) {
  return (
    <div className={s.result}>
      <PartyPopper size={34} strokeWidth={2.75} color="var(--sage)" />
      <span className={s.rTitle}>{title}</span>
      <span className={s.rSub}>{sub}</span>
      <div className={s.rStats}>
        {stats.map((x) => (
          <div key={x.k} data-xp={x.xp ? 'src' : undefined} className={s.rStat}>
            <b style={{ color: x.fg }}>{x.v}</b>
            <span>{x.k}</span>
          </div>
        ))}
      </div>
      <div className={s.rBtns}>
        {actions.map((a) => (
          <button key={a.label} onClick={a.onClick} className={a.kind === 'primary' ? s.primary : a.kind === 'soft' ? s.soft : s.ghost}>
            {a.label}
            {a.kind === 'primary' && <ArrowRight size={14} strokeWidth={2.75} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export const fmtTime = (ms: number) => {
  const sec = Math.max(1, Math.round(ms / 1000));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
};

export function rewardLabel(r: { total: number; multiplier: number; reviewBonus: number }) {
  const extra: string[] = [];
  if (r.multiplier !== 1) extra.push('반복 ×' + r.multiplier);
  if (r.reviewBonus) extra.push('복습 +' + r.reviewBonus);
  return '+' + r.total + (extra.length ? ` (${extra.join(' · ')})` : '');
}
