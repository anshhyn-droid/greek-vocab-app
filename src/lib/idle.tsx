// 자동 로그아웃 (design/gk-session.js, db/보안_개인정보_명세.md 2)
// 마지막 활동(클릭·키 입력 등) 후 24시간이 지나면 로그아웃. 남은 시간이 1분이면 안내 창
// 활동 시각은 localStorage라 여러 탭이 함께 씀 → 한 탭에서 움직이면 다른 탭도 연장
import { useEffect, useState } from 'react';
import { LS } from './storage';

export const LAST_ACTIVE = 'gk_last_active';
export const LOGOUT_REASON = 'gk_logout_reason';
export const IDLE_MS = 24 * 60 * 60 * 1000;
const WARN_SEC = 60;

export const markActive = () => LS.set(LAST_ACTIVE, String(Date.now()));

// 로그인한 화면에서만 씀. onExpire = 시간이 다 돼 로그아웃(이유 idle), onLogout = 안내 창에서 직접 로그아웃
export function IdleWatcher({ onExpire, onLogout }: { onExpire: () => void; onLogout: () => void }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let warning = false;
    const touch = () => { if (!warning) markActive(); }; // 안내 창이 떠 있으면 "계속 사용하기"로만 연장
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    if (!LS.get(LAST_ACTIVE)) markActive();
    const tick = () => {
      const last = Number(LS.get(LAST_ACTIVE)) || Date.now();
      const sec = Math.ceil((IDLE_MS - (Date.now() - last)) / 1000);
      if (sec <= 0) return onExpire();
      warning = sec <= WARN_SEC;
      setLeft(warning ? sec : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      evs.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [onExpire]);

  if (left == null) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div role="alertdialog" aria-live="assertive" aria-labelledby="idle-t" style={{ width: '100%', maxWidth: 380, padding: '26px 24px 20px', borderRadius: 30, background: '#fffaf1', border: '1.5px solid var(--line)', boxShadow: '0 24px 50px -24px rgba(32,30,29,.55)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 16px 'Pretendard Variable',Pretendard,sans-serif" }}>{left}</span>
        <span id="idle-t" style={{ fontFamily: 'var(--f-title)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>곧 자동으로 로그아웃됩니다</span>
        <span style={{ font: '500 14px/1.6 var(--f-body)', color: 'var(--muted)', wordBreak: 'keep-all' }}>
          한동안 사용하지 않아 <b style={{ color: 'var(--accent-ink)' }}>{left}초</b> 뒤 로그아웃됩니다. 풀던 문제는 저장되지 않습니다.
        </span>
        <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
          <button autoFocus onClick={() => { markActive(); setLeft(null); }} style={{ flex: 1.4, padding: 13, borderRadius: 999, background: 'var(--btn)', color: '#fffaf1', font: '700 14px var(--f-body)' }}>계속 사용하기</button>
          <button onClick={onLogout} style={{ flex: 1, padding: 13, borderRadius: 999, border: '1.5px solid var(--line)', color: 'var(--muted)', font: '700 14px var(--f-body)' }}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
