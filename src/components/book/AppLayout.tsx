// 로그인 후 모든 화면의 틀. 책(또는 폰 테두리)과 탭은 여기 한 번만 그려서
// 화면을 옮겨도 크기·위치가 바뀌거나 다시 그려지지 않음
import { useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useBookSize } from '../../lib/viewport';
import { LeaveContext, type LeaveGuard } from './leave';
import { TABS, tabOf } from './tabs';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const size = useBookSize();
  const active = tabOf(useLocation().pathname);
  const navigate = useNavigate();
  const guard = useRef<LeaveGuard | null>(null);
  const goTab = (to: string) => {
    const go = () => navigate(to);
    if (guard.current) guard.current(go);
    else go();
  };

  return (
    <LeaveContext.Provider value={{ guard }}>
      {size.narrow ? (
        <div className={styles.phone}>
          <div className={styles.phoneContent}>
            <Outlet />
          </div>
          {/* 화면 가장자리 가죽 테두리 + 금박 선 (내용 위에 겹쳐 그리되 누르기는 통과) */}
          <div className={styles.phoneFrame} aria-hidden="true">
            <div className={styles.phoneLeather} />
            <div className={styles.phoneGold} />
          </div>
          <nav className={styles.tabBar} aria-label="메뉴">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => goTab(t.to)} className={styles.tabBarItem} data-on={t.k === active} data-xp-target={t.k === active} aria-current={t.k === active ? 'page' : undefined}>
                <t.icon size={21} strokeWidth={2.75} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div
          className={styles.book}
          style={{ left: size.left, top: size.top, width: size.BW, height: size.BH }}
        >
          <nav className={styles.tabs} aria-label="메뉴">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => goTab(t.to)} className={styles.tab} data-on={t.k === active} data-xp-target={t.k === active} aria-current={t.k === active ? 'page' : undefined} title={t.label}>
                {/* 낮은 책에서는 탭 글자를 줄여 탭 안에 들어가게 */}
                <span style={size.BH < 600 ? { fontSize: 15 } : undefined}>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.inside}>
            <Outlet />
          </div>
        </div>
      )}
    </LeaveContext.Provider>
  );
}
