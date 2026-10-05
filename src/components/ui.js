'use client';
// 여러 화면이 함께 쓰는 작은 조각들
import { CloudOff } from 'lucide-react';

// Lucide 아이콘 (선 두께 2.75)
export function Ic({ icon: Icon, size = 18, color, style, className = '', ...rest }) {
  return (
    <span className={'ic ' + className} style={{ width: size, height: size, color, ...style }} {...rest}>
      <Icon strokeWidth={2.75} />
    </span>
  );
}

// 헬라어 부분만 설정 크기(--gk-scale)로 키움. 한글과 섞인 문법 문장에 씀
const GREEK_RUN = /([Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿̀-ͯ]*(?:\s+[Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿̀-ͯ]*)*)/;
export function GreekText({ text }) {
  if (text == null) return null;
  return String(text)
    .split(GREEK_RUN)
    .map((part, i) => (i % 2 ? <span key={i} className="gk-run">{part}</span> : part));
}

// 학습 화면 공통 버튼 모양
export const pillBtn = {
  primary: { cursor: 'pointer', borderRadius: 999, background: 'var(--btn)', color: 'var(--on-accent)', font: "800 13.5px 'Noto Sans KR',sans-serif", textAlign: 'center' },
  ghost: { cursor: 'pointer', borderRadius: 999, border: '1.5px solid var(--line)', font: "800 13.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)', textAlign: 'center' },
  soft: { cursor: 'pointer', borderRadius: 999, border: '1.5px solid var(--bd-cur)', background: 'var(--card)', font: "800 13.5px 'Noto Sans KR',sans-serif", color: 'var(--accent-ink)', textAlign: 'center' },
};

// 나가기 확인 창 (메뉴_이동_명세 3번). 바깥을 누르면 계속 풀기
export function ExitDialog({ open, onStay, onLeave }) {
  if (!open) return null;
  return (
    <div onClick={onStay} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 380, padding: '26px 24px 20px', borderRadius: 30, background: 'var(--card)', border: '1.5px solid var(--line)', boxShadow: 'var(--sh-dialog)', display: 'flex', flexDirection: 'column', gap: 12, animation: 'pop .2s ease-out' }}
      >
        <span style={{ fontFamily: 'var(--f-head)', fontSize: 21, color: 'var(--ink)' }}>학습을 그만할까요?</span>
        <span style={{ font: "500 13.5px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)', wordBreak: 'keep-all' }}>
          지금 나가면 이번 진행 상황이 사라지고, 다음에 처음부터 다시 시작합니다.
        </span>
        <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
          <button autoFocus onClick={onStay} className="press h-btn" style={{ ...pillBtn.primary, flex: 1.3, padding: 13 }}>계속 풀기</button>
          <button onClick={onLeave} className="press h-tile" style={{ ...pillBtn.ghost, flex: 1, padding: 13 }}>나가기</button>
        </div>
      </div>
    </div>
  );
}

// 불러오기 실패 (메뉴_이동_명세 4번)
export function LoadError({ onRetry, onMenu }) {
  return (
    <div style={{ padding: '44px 26px', borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <Ic icon={CloudOff} size={30} color="var(--wrong)" />
      <span style={{ font: "800 15px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>문제를 불러오지 못했습니다</span>
      <span style={{ font: "500 13px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)', wordBreak: 'keep-all' }}>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</span>
      <div style={{ display: 'flex', gap: 9, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onRetry} className="press h-btn" style={{ ...pillBtn.primary, padding: '12px 24px' }}>다시 시도</button>
        <button onClick={onMenu} className="press h-tile" style={{ ...pillBtn.ghost, padding: '12px 24px' }}>과 메뉴로</button>
      </div>
    </div>
  );
}

export function LoadingCard({ text }) {
  return (
    <div style={{ padding: '60px 24px', borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)', textAlign: 'center', font: "600 13px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>
      {text}
    </div>
  );
}

// 진행 동그라미: 처음 답한 순서대로 채움 (한 번에 초록 · 틀렸다 맞힘 빨강 · 지금 주황, 다시 푸는 칸은 빨간 테두리)
export function dotStates(total, cleared, curId, live) {
  const seen = cleared.some((c) => c.id === curId);
  return Array.from({ length: total }, (_, i) => {
    const c = cleared[i];
    const now = live && (c ? c.id === curId : !seen && i === cleared.length);
    return {
      n: i + 1,
      bg: now ? 'transparent' : c ? (c.re ? 'var(--wrong)' : 'var(--sage)') : 'transparent',
      bd: now && c ? 'var(--wrong)' : now ? 'var(--accent)' : c ? (c.re ? 'var(--wrong)' : 'var(--sage)') : 'var(--line)',
      fg: now && c ? 'var(--wrong-ink)' : now ? 'var(--accent-ink)' : c ? 'var(--on-accent)' : 'var(--muted)',
    };
  });
}

// cols: 격자 칸 수(단어·문법) / size: 고정 크기(문장)
export function Dots({ dots, cols, size, fontSize, gap }) {
  const wrap = cols
    ? { display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap }
    : { display: 'flex', flexWrap: 'wrap', gap };
  return (
    <div style={wrap}>
      {dots.map((d) => (
        <span
          key={d.n}
          style={{
            ...(size ? { width: size, height: size, flex: 'none' } : { aspectRatio: '1' }),
            borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: d.bg, boxShadow: `inset 0 0 0 2px ${d.bd}`,
            font: `800 ${fontSize}px 'Figtree',sans-serif`, color: d.fg, fontVariantNumeric: 'tabular-nums', transition: 'background .25s',
          }}
        >
          {d.n}
        </span>
      ))}
    </div>
  );
}

export function DotLegend() {
  const item = (style, label) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, ...style }} />
      {label}
    </span>
  );
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', font: "600 11px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>
      {item({ background: 'var(--sage)' }, '한 번에')}
      {item({ background: 'var(--wrong)' }, '다시 풀어 맞힘')}
      {item({ boxShadow: 'inset 0 0 0 2px var(--accent)' }, '지금')}
      {item({ boxShadow: 'inset 0 0 0 2px var(--wrong)' }, '다시 푸는 중')}
    </div>
  );
}

// 결과 카드의 통계 칸 3개. data-xp="src" 칸에서 경험치 칩이 날아감
export function ResultStats({ stats, big, maxWidth }) {
  return (
    <div style={{ marginTop: 10, width: '100%', maxWidth, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: big ? 10 : 8 }}>
      {stats.map((r) => (
        <div
          key={r.k}
          data-xp={r.xp}
          style={{ padding: big ? '14px 8px' : '12px 8px', borderRadius: big ? 22 : 20, background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
        >
          <span style={{ font: `800 ${big ? 18 : 16}px 'Figtree',sans-serif`, color: r.fg || 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
          <span style={{ font: `700 ${big ? 10.5 : 10}px 'Noto Sans KR',sans-serif`, color: 'var(--muted)' }}>{r.k}</span>
        </div>
      ))}
    </div>
  );
}

// 저장 실패 시 결과 카드 아래 안내
export function SaveError({ onRetry }) {
  return (
    <span style={{ font: "700 12px 'Noto Sans KR',sans-serif", color: 'var(--wrong-ink)' }}>
      기록을 저장하지 못했습니다 ·{' '}
      <button onClick={onRetry} style={{ cursor: 'pointer', textDecoration: 'underline', font: 'inherit', color: 'inherit' }}>다시 저장</button>
    </span>
  );
}
