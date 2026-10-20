// 가운데 창 (바깥을 누르면 닫힘). 약관·탈퇴·목표 수정 등에서 함께 씀
import type { CSSProperties, ReactNode } from 'react';

export default function Dialog({ onClose, children, maxWidth = 380, style }: { onClose?: () => void; children: ReactNode; maxWidth?: number; style?: CSSProperties }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="scroll-hidden"
        style={{ width: '100%', maxWidth, maxHeight: '86vh', padding: '26px 22px 18px', borderRadius: 30, background: 'var(--card)', boxShadow: '0 24px 50px -24px rgba(32,30,29,.55)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'pop .22s ease-out', ...style }}
      >
        {children}
      </div>
    </div>
  );
}
