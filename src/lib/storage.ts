// 기기 저장값(localStorage). 학습 정보는 "gk_" 로 시작. 실패해도 앱은 계속 동작
export const LS = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 진행 */ }
  },
  remove(k: string) {
    try { localStorage.removeItem(k); } catch { /* 무시 */ }
  },
  // 로그아웃: 기기에 남은 학습 정보를 모두 지움 (keep만 남김)
  wipe(keep: string[] = []) {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('gk_') && !keep.includes(k)).forEach((k) => localStorage.removeItem(k));
    } catch { /* 무시 */ }
  },
};
