'use client';
// 하루 미사용 자동 로그아웃 (보안·개인정보 명세 2). 판단은 서버, 화면은 남은 1분 동안 안내만
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, publishExpiry, sessionChannel } from '@/lib/api';
import { pillBtn } from './ui';

const WARN_SEC = 60;
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
const goStart = (q) => (window.location.href = '/start' + q);

export default function IdleGuard({ initialExpiresAt }) {
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [left, setLeft] = useState(null); // 안내 창의 남은 초. null이면 닫힘
  const pathname = usePathname();

  // 화면을 옮기면 서버가 연장했으므로 새 시각을 받아 옴
  useEffect(() => {
    api('/api/session').then((d) => publishExpiry(d.idleExpiresAt)).catch(() => {});
  }, [pathname]);

  // 다른 요청·다른 탭에서 연장되면 새 시각으로
  useEffect(() => {
    const onLocal = (e) => setExpiresAt(e.detail);
    const ch = sessionChannel();
    const onTab = (e) => setExpiresAt(e.data);
    window.addEventListener('gk-session', onLocal);
    ch?.addEventListener('message', onTab);
    // 탭으로 돌아오면 서버에 다시 물어봄 (돌아온 것도 사용으로 연장)
    const onVisible = () => document.visibilityState === 'visible' && api('/api/session').then((d) => publishExpiry(d.idleExpiresAt)).catch(() => {});
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('gk-session', onLocal);
      ch?.removeEventListener('message', onTab);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    let timer;
    const tick = () => {
      const sec = Math.ceil((expiresAt - Date.now()) / 1000);
      if (sec <= 0) {
        setLeft(0);
        api('/api/auth/logout?reason=idle', { method: 'POST' }).catch(() => {}).finally(() => goStart('?notice=idle'));
        return;
      }
      setLeft(sec <= WARN_SEC ? sec : null);
      // 안내 전에는 1분 전까지 기다렸다가, 안내 중에는 1초마다
      timer = setTimeout(tick, sec > WARN_SEC ? Math.min((sec - WARN_SEC) * 1000, 2 ** 31 - 1) : 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [expiresAt]);

  if (left == null) return null;
  const stay = () => api('/api/session', { method: 'POST' }).then((d) => publishExpiry(d.idleExpiresAt)).catch(() => {});
  const leave = () => api('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => goStart(''));
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" style={{ width: '100%', maxWidth: 380, padding: '26px 24px 20px', borderRadius: 30, background: 'var(--card)', border: '1.5px solid var(--line)', boxShadow: 'var(--sh-dialog)', display: 'flex', flexDirection: 'column', gap: 12, animation: 'pop .2s ease-out' }}>
        <span id="idle-title" style={{ fontFamily: 'var(--f-head)', fontSize: 21, color: 'var(--ink)' }}>곧 자동으로 로그아웃됩니다</span>
        <span style={{ font: "500 13.5px/1.6 'Noto Sans KR',sans-serif", color: 'var(--muted)', wordBreak: 'keep-all' }}>
          <b style={{ color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' }}>{left}초</b> 뒤 로그아웃됩니다. 풀던 문제는 저장되지 않습니다.
        </span>
        <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
          <button autoFocus onClick={stay} className="press h-btn" style={{ ...pillBtn.primary, flex: 1.3, padding: 13 }}>계속 사용하기</button>
          <button onClick={leave} className="press h-tile" style={{ ...pillBtn.ghost, flex: 1, padding: 13 }}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
