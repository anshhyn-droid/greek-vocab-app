// 마이페이지 (steps/step09_mypage.md): 학습 기록·설정·기록 초기화·회원 탈퇴
import { getDb } from '../db.js';
import { bad, body, json } from '../http.js';
import { clearSession, logAccess, requireRecentLogin, requireUser } from '../session.js';
import { localDate, timezoneOf } from '../user.js';

// 이메일은 앞 두 글자만 (yo*******@gmail.com)
const maskEmail = (e: string) => {
  const [local, domain] = String(e || '').split('@');
  return domain ? local.slice(0, 2) + '*'.repeat(Math.max(1, local.length - 2)) + '@' + domain : '';
};

export async function summary(req: Request) {
  const { user } = await requireUser(req);
  const db = await getDb();
  const tz = await timezoneOf(db, user.id);
  const today = localDate(tz);
  const days = Array.from({ length: 7 }, (_, i) => localDate(tz, new Date(Date.now() - (6 - i) * 864e5)));
  const [stats, settings, week, progress] = await Promise.all([
    db.get<{ xp_total: number; study_days: number }>('SELECT xp_total, study_days FROM user_stats WHERE user_id = ?', user.id),
    db.get<{ font_size: string }>('SELECT font_size FROM user_settings WHERE user_id = ?', user.id),
    db.all<{ date: string; xp_earned: number }>('SELECT date, xp_earned FROM daily_activity WHERE user_id = ? AND date >= ?', user.id, days[0]),
    db.all<{ lesson_id: number; type: string; status: string }>('SELECT lesson_id, type, status FROM lesson_progress WHERE user_id = ?', user.id),
  ]);
  const xpBy = Object.fromEntries(week.map((w) => [w.date, w.xp_earned]));
  return json({
    name: user.display_name,
    email: maskEmail(user.email),
    fontSize: settings?.font_size || 'm',
    xp: stats?.xp_total ?? 0,
    studyDays: stats?.study_days ?? 0,
    today,
    week: days.map((d) => ({ date: d, xp: xpBy[d] || 0 })),
    progress: progress.map((p) => ({ lesson: p.lesson_id, type: p.type, status: p.status })),
  });
}

// 글자 크기 m / l / xl
export async function setSettings(req: Request) {
  const { user } = await requireUser(req);
  const b = await body<{ fontSize?: string }>(req);
  if (!['m', 'l', 'xl'].includes(String(b.fontSize))) throw bad('fontSize');
  await (await getDb()).run("UPDATE user_settings SET font_size = ?, updated_at = ? WHERE user_id = ?", b.fontSize!, new Date().toISOString(), user.id);
  return json({ fontSize: b.fontSize });
}

// 학습 기록 초기화: 경험치·기록·진도·오답 노트·책갈피·이어서 하기·오늘 진행 삭제. 계정·설정·동의는 남김
export async function resetRecords(req: Request) {
  const s = await requireUser(req);
  requireRecentLogin(s);
  const db = await getDb();
  await db.tx(async (tx) => {
    for (const t of ['answer_log', 'study_runs', 'wrong_notes', 'bookmarks', 'lesson_progress', 'daily_activity']) await tx.run(`DELETE FROM ${t} WHERE user_id = ?`, s.user.id);
    await tx.run('UPDATE user_stats SET xp_total = 0, streak_current = 0, streak_best = 0, study_days = 0, last_study_date = NULL WHERE user_id = ?', s.user.id);
  });
  await logAccess(req, 'reset', s.user.id, db);
  return json({ ok: true });
}

// 회원 탈퇴 { confirm: true }: 사용자와 연결된 모든 행 삭제 (접속 기록은 user_id만 비우고 3개월 보관). 세션 폐기
export async function withdraw(req: Request) {
  const s = await requireUser(req);
  if ((await body(req)).confirm !== true) throw bad('confirm');
  requireRecentLogin(s);
  const db = await getDb();
  await db.tx(async (tx) => {
    // ON DELETE CASCADE가 켜져 있지 않은 연결에서도 남지 않도록 표마다 직접 지움
    for (const t of ['answer_log', 'study_runs', 'wrong_notes', 'bookmarks', 'lesson_progress', 'daily_activity', 'user_stats', 'user_goals', 'user_settings', 'user_consents', 'auth_sessions']) await tx.run(`DELETE FROM ${t} WHERE user_id = ?`, s.user.id);
    await tx.run('UPDATE access_logs SET user_id = NULL WHERE user_id = ?', s.user.id);
    await tx.run('DELETE FROM users WHERE id = ?', s.user.id);
    await logAccess(req, 'withdraw', null, tx);
  });
  const h = new Headers();
  clearSession().forEach((c) => h.append('set-cookie', c));
  return json({ ok: true }, 200, h);
}

