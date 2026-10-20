// 나가기 경고 (공통 규칙): ← 또는 오른쪽 탭을 누르면 확인 창
import { useContext, useEffect, useState } from 'react';
import { LeaveContext } from '../components/book/leave';
import Dialog from '../components/ui/Dialog';
import s from './study.module.css';

export function useLeaveGuard(active: boolean, kind: 'study' | 'test', onLeave?: () => void) {
  const { guard } = useContext(LeaveContext);
  const [pending, setPending] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!active) return;
    guard.current = (go) => setPending(() => go);
    return () => { guard.current = null; };
  }, [active, guard]);
  // ← 버튼: 진행 중이면 확인, 아니면 바로
  const request = (go: () => void) => (active ? setPending(() => go) : go());
  const dialog = pending && (
    <Dialog onClose={() => setPending(null)}>
      <span className={s.dTitle}>{kind === 'study' ? '학습을 그만할까요?' : '테스트를 그만할까요?'}</span>
      {kind === 'study' ? (
        <span className={s.dBody}>지금까지 푼 곳은 저장돼서 이어서 할 수 있어요.<br /><b className={s.red}>경험치와 학습 기록은 끝까지 마쳐야 남습니다.</b></span>
      ) : (
        <span className={s.dBody}><b className={s.red}>지금 나가면 이번 테스트의 경험치와 기록이 남지 않습니다.</b><br />틀린 문항은 오답 노트에 남고, 다시 시작하면 처음부터 풉니다.</span>
      )}
      <div className={s.dBtns}>
        <button autoFocus onClick={() => setPending(null)} className={s.primary} style={{ flex: 1.3 }}>계속 풀기</button>
        <button
          onClick={() => {
            const go = pending;
            setPending(null);
            guard.current = null;
            onLeave?.();
            go();
          }}
          className={s.ghost}
          style={{ flex: 1 }}
        >
          나가기
        </button>
      </div>
    </Dialog>
  );
  return { dialog, request };
}
