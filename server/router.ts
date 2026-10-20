// /api 요청을 처리 함수로 보냄 (Vercel 함수 api/index.ts와 개발 서버가 함께 씀)
import { HttpError, json } from './http.js';
import { consent, consentCancel, googleCallback, googleStart, logout, me } from './routes/auth.js';
import { clearLesson, home, setGoals } from './routes/home.js';
import { resetRecords, setSettings, summary, withdraw } from './routes/me.js';
import { abandonRun, finishRun, listBookmarks, listNotes, saveRun, startRun, toggleBookmark } from './routes/runs.js';

type Handler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Handler> = {
  'GET /api/auth/google': googleStart,
  'GET /api/auth/callback/google': googleCallback,
  'POST /api/auth/consent': consent,
  'DELETE /api/auth/consent': consentCancel,
  'POST /api/auth/logout': logout,
  'GET /api/me': me,
  'GET /api/home': home,
  'PATCH /api/goals': setGoals,
  'DELETE /api/progress': clearLesson,
  'POST /api/runs': startRun,
  'GET /api/bookmarks': listBookmarks,
  'POST /api/bookmarks': toggleBookmark,
  'GET /api/notes': listNotes,
  'GET /api/me/summary': summary,
  'PATCH /api/settings': setSettings,
  'POST /api/me/reset': resetRecords,
  'POST /api/me/withdraw': withdraw,
};

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Vercel에서는 /api/* 를 api/index?path=… 로 넘김 (vercel.json)
  const path = url.searchParams.get('__path') != null ? '/api/' + url.searchParams.get('__path') : url.pathname;
  const p = path.replace(/\/$/, '');
  // 회차: /api/runs/:id (PUT 저장) · /api/runs/:id/finish · /api/runs/:id/abandon
  const run = /^\/api\/runs\/([0-9a-f-]{36})(?:\/(finish|abandon))?$/.exec(p);
  const h: Handler | undefined = run
    ? req.method === 'PUT' && !run[2] ? (r) => saveRun(r, run[1])
      : req.method === 'POST' && run[2] === 'finish' ? (r) => finishRun(r, run[1])
      : req.method === 'POST' && run[2] === 'abandon' ? (r) => abandonRun(r, run[1]) : undefined
    : ROUTES[`${req.method} ${p}`];
  if (!h) return json({ error: 'not_found' }, 404);
  try {
    return await h(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'server_error' }, 500);
  }
}
