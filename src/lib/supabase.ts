// Supabase 연결. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (README 참고)
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(url && key);

// 설정이 없으면 화면이 안내만 하도록 가짜 주소로 만들어 둠 (요청은 보내지 않음)
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
