// 로그인 상태. Google 로그인(Supabase OAuth) → 처음이면 약관 동의 → 가입(users·설정·목표 기본 행)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { LS } from './storage';
import { IDLE_MS, LAST_ACTIVE, LOGOUT_REASON, markActive } from './idle';

// 약관·처리방침 문안을 바꾸면 버전을 올림 → 다음 로그인 때 다시 동의를 받음
export const CONSENT_VERSION = '2026-10-18';
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
  session: Session | null;
  profile: Profile | null;
  error: string | null;
  signIn: () => Promise<void>;
  acceptConsent: () => Promise<void>;
  signOut: (reason?: Reason) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider 밖');
  return v;
}

const googleSub = (s: Session) =>
  s.user.identities?.find((i) => i.provider === 'google')?.id || (s.user.user_metadata?.sub as string) || s.user.id;
const googleName = (s: Session) => {
  const m = s.user.user_metadata || {};
  return String(m.full_name || m.name || s.user.email?.split('@')[0] || '학습자').slice(0, 40);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>(supabaseConfigured ? 'loading' : 'signedOut');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async (reason: Reason = 'manual') => {
    await supabase.auth.signOut().catch(() => {});
    // 기기에 남은 학습 정보를 지움
    LS.wipe();
    if (reason !== 'manual') LS.set(LOGOUT_REASON, reason);
    setSession(null);
    setProfile(null);
    setStatus('signedOut');
  }, []);

  // 세션이 있으면: 가입(users)과 지금 버전 약관 동의를 확인
  const resolve = useCallback(
    async (s: Session | null) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setStatus('signedOut');
        return;
      }
      // 하루 동안 사용하지 않았으면 로그아웃
      const last = Number(LS.get(LAST_ACTIVE));
      if (last && Date.now() - last > IDLE_MS) return signOut('idle');
      if (!last) markActive();

      const uid = s.user.id;
      const [{ data: u, error: e1 }, { data: c, error: e2 }] = await Promise.all([
        supabase.from('users').select('id,email,display_name').eq('id', uid).maybeSingle(),
        supabase.from('user_consents').select('type').eq('user_id', uid).eq('version', CONSENT_VERSION).eq('agreed', true),
      ]);
      if (e1 || e2) {
        setError((e1 || e2)!.message);
        setStatus('signedOut');
        return;
      }
      const agreed = new Set((c || []).map((r) => r.type));
      if (u && CONSENT_TYPES.every((t) => agreed.has(t))) {
        setProfile(u as Profile);
        setStatus('ready');
      } else {
        setProfile(null);
        setStatus('needsConsent');
      }
    },
    [signOut],
  );

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // 토큰 갱신 같은 일은 다시 확인할 필요 없음
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(() => resolve(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [resolve]);

  const signIn = useCallback(async () => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/', queryParams: { prompt: 'select_account' } },
    });
    if (e) setError(e.message);
  }, []);

  // 약관 동의 → 가입: users, user_consents, user_settings, user_goals, user_stats 기본 행
  const acceptConsent = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const now = new Date().toISOString();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
    const steps = [
      () => supabase.from('users').upsert({ id: uid, google_sub: googleSub(session), email: session.user.email, display_name: googleName(session), last_login_at: now }, { onConflict: 'id' }),
      () => supabase.from('user_consents').upsert(CONSENT_TYPES.map((type) => ({ user_id: uid, type, version: CONSENT_VERSION, agreed: true, agreed_at: now })), { onConflict: 'user_id,type,version' }),
      () => supabase.from('user_settings').upsert({ user_id: uid, font_size: 'm', timezone: tz }, { onConflict: 'user_id', ignoreDuplicates: true }),
      () => supabase.from('user_goals').upsert({ user_id: uid }, { onConflict: 'user_id', ignoreDuplicates: true }),
      () => supabase.from('user_stats').upsert({ user_id: uid }, { onConflict: 'user_id', ignoreDuplicates: true }),
    ];
    for (const run of steps) {
      const { error: e } = await run();
      if (e) {
        setError(e.message);
        throw e;
      }
    }
    markActive();
    await resolve(session);
  }, [session, resolve]);

  const value = useMemo(() => ({ status, session, profile, error, signIn, acceptConsent, signOut }), [status, session, profile, error, signIn, acceptConsent, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
