// 나가기 확인: 학습·테스트 중인 화면이 등록하면, 탭·뒤로를 누를 때 바로 옮기지 않고 확인 창을 띄움
import { createContext, useContext } from 'react';

export type LeaveGuard = (go: () => void) => void;

export const LeaveContext = createContext<{ guard: { current: LeaveGuard | null } }>({ guard: { current: null } });

// 화면 이동: 등록된 확인이 있으면 그쪽에 맡김
export function useGuardedGo() {
  const { guard } = useContext(LeaveContext);
  return (go: () => void) => (guard.current ? guard.current(go) : go());
}
