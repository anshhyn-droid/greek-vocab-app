// 로그인 상태 (서버 세션). Google 로그인 → 처음이면 약관 동의 → 가입
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { IDLE_MS, LAST_ACTIVE, LOGOUT_REASON, markActive } from './idle';
import { LS } from './storage';
import { setFontSize } from './viewport';

export const CONSENT_TYPES = ['age', 'terms', 'privacy'] as const;

export interface Profile {
  id: string;
  email: string;
  display_name: string;
}

type Status = 'loading' | 'signedOut' | 'needsConsent' | 'ready';
type Reason = 'idle' | 'withdrawn' | 'manual';

interface AuthValue {
  status: Status;
  profile: Profile | null;
  signIn: () => void;
  acceptConsent: () => Promise<void>;
  cancelConsent: () => Promise<void>;
  signOut: (reason?: Reason) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider 밖');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  // 로그아웃 처리: 기기에 남은 학습 정보를 지우고, 이유가 있으면 다음 첫 화면에 안내
  // 같은 로그아웃이 두 번 처리되지 않게 (두 번째가 지난 이유를 다시 남기면 다음 첫 화면에 또 안내가 뜸)
  const out = useRef(false);
  const finishSignOut = useCallback((reason: Reason) => {
    if (out.current) return;
    out.current = true;
    LS.wipe();
    setFontSize('m');
    if (reason !== 'manual') LS.set(LOGOUT_REASON, reason);
    setProfile(null);
    setStatus('signedOut');
  }, []);

  const signOut = useCallback(
    async (reason: Reason = 'manual') => {
      if (out.current) return;
      await api('/api/auth/logout', { method: 'POST', body: { reason } }).catch(() => {});
      finishSignOut(reason);
    },
    [finishSignOut],
  );

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ status: Status; profile?: Profile; reason?: string; fontSize?: string }>('/api/me');
      if (r.status !== 'signedOut') out.current = false;
      if (r.status === 'ready') {
        // 이 기기에서 하루 넘게 움직임이 없었으면 로그아웃 (마지막 활동 = 클릭·키 입력)
        const last = Number(LS.get(LAST_ACTIVE));
        if (last && Date.now() - last > IDLE_MS) return signOut('idle');
        if (!last) markActive();
        setProfile(r.profile!);
        setFontSize(r.fontSize || 'm');
      } else {
        setProfile(null);
        if (r.reason === 'idle') finishSignOut('idle');
      }
      setStatus(r.status);
    } catch {
      setStatus('signedOut');
    }
  }, [signOut, finishSignOut]);

  useEffect(() => {
    // 다른 API가 401(세션 끝)을 받으면 첫 화면으로
    setUnauthorizedHandler((code) => finishSignOut(code === 'idle' ? 'idle' : 'manual'));
    refresh();
  }, [refresh, finishSignOut]);

  // 서버의 Google 로그인 시작 주소로 이동
  // eslint-disable-next-line react-hooks/immutability
  const signIn = useCallback(() => { window.location.href = '/api/auth/google'; }, []);

  const acceptConsent = useCallback(async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
    await api('/api/auth/consent', { method: 'POST', body: { age: true, terms: true, privacy: true, timezone: tz } });
    out.current = false;
    markActive();
    await refresh();
  }, [refresh]);

  const cancelConsent = useCallback(async () => {
    await api('/api/auth/consent', { method: 'DELETE' }).catch(() => {});
    finishSignOut('manual');
  }, [finishSignOut]);

  const value = useMemo(() => ({ status, profile, signIn, acceptConsent, cancelConsent, signOut, refresh }), [status, profile, signIn, acceptConsent, cancelConsent, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
