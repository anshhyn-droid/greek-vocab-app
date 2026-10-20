// 요청·응답 도우미 (Web 표준 Request/Response — Vercel 함수와 개발 서버가 같은 코드를 씀)

export class HttpError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}
export const bad = (code: string) => new HttpError(400, code);

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set('content-type', 'application/json; charset=utf-8');
  h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function redirect(to: string, cookies: string[] = []): Response {
  const h = new Headers({ location: to, 'cache-control': 'no-store' });
  cookies.forEach((c) => h.append('set-cookie', c));
  return new Response(null, { status: 302, headers: h });
}

export function readCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const secure = () => process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// httpOnly=false는 화면 스크립트가 읽어야 하는 쿠키(CSRF 토큰)만
export function cookie(name: string, value: string, maxAgeSec: number, httpOnly = true): string {
  return [`${name}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${maxAgeSec}`, 'SameSite=Lax', httpOnly && 'HttpOnly', secure() && 'Secure'].filter(Boolean).join('; ');
}
export const clearCookie = (name: string) => cookie(name, '', 0);

export const appOrigin = (req: Request) => process.env.APP_URL || new URL(req.url).origin;

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
