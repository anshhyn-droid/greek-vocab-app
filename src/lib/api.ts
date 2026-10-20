// 서버 API 호출. 상태를 바꾸는 요청에는 CSRF 토큰(gk_csrf 쿠키 값)을 머리글로 붙임
export class ApiError extends Error {
  status: number;
  code: string;
  data: unknown;
  constructor(status: number, code: string, data?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const csrf = () => document.cookie.match(/(?:^|; )gk_csrf=([^;]*)/)?.[1] || '';

// 로그인이 풀렸을 때(401) 화면이 할 일. auth.tsx가 등록
let onUnauthorized: ((code: string) => void) | null = null;
export const setUnauthorizedHandler = (fn: (code: string) => void) => { onUnauthorized = fn; };

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method || 'GET';
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(csrf());
  const res = await fetch(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data as { error?: string }).error || 'http_' + res.status;
    if (res.status === 401 && path !== '/api/auth/consent') onUnauthorized?.(code);
    throw new ApiError(res.status, code, data);
  }
  return data as T;
}
