// /api 요청을 처리 함수로 보냄 (Vercel 함수 api/index.ts와 개발 서버가 함께 씀)
import { HttpError, json } from './http.js';
import { consent, consentCancel, googleCallback, googleStart, logout, me } from './routes/auth.js';

type Handler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Handler> = {
  'GET /api/auth/google': googleStart,
  'GET /api/auth/callback/google': googleCallback,
  'POST /api/auth/consent': consent,
  'DELETE /api/auth/consent': consentCancel,
  'POST /api/auth/logout': logout,
  'GET /api/me': me,
};

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Vercel에서는 /api/* 를 api/index?path=… 로 넘김 (vercel.json)
  const path = url.searchParams.get('__path') != null ? '/api/' + url.searchParams.get('__path') : url.pathname;
  const h = ROUTES[`${req.method} ${path.replace(/\/$/, '')}`];
  if (!h) return json({ error: 'not_found' }, 404);
  try {
    return await h(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'server_error' }, 500);
  }
}
