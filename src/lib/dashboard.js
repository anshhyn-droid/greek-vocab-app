// 목차·마이페이지에 보여줄 값 (서버 전용)
import { getDb } from './db';
import { getSettings } from './users';
import { localDate, addDays } from './time';
import { allLessons } from './content';
import { liveStreak } from './record';
import { STEPS } from './lesson';

export async function profile(user) {
  const s = await getSettings(user.id);
  return {
    name: user.display_name,
    email: user.email,
    avatar: user.avatar_url,
    inviteCode: user.invite_code,
    settings: { lang: s.ui_lang, mode: s.theme_mode, greekSize: s.greek_size, remind: !!s.remind_on, sound: !!s.sound_on },
  };
}

// 과별 완료(lesson_progress status = done)
export async function progressByLesson(userId) {
  const out = {};
  for (const r of await (await getDb()).all("SELECT lesson_id, type FROM lesson_progress WHERE user_id = ? AND status = 'done'", userId)) {
    (out[r.lesson_id] ||= []).push(r.type);
  }
  return out;
}

export async function todayGoal(userId, today) {
  const db = await getDb();
  const g = await db.get('SELECT * FROM user_goals WHERE user_id = ?', userId);
  const a = (await db.get('SELECT * FROM daily_activity WHERE user_id = ? AND date = ?', userId, today)) || {};
  const rows = [
    { k: 'word', label: '단어', goal: g.goal_word, done: a.word_done || 0 },
    { k: 'gram', label: '문법', goal: g.goal_gram, done: a.gram_done || 0 },
    { k: 'sent', label: '문장', goal: g.goal_sent, done: a.sent_done || 0 },
  ].map((r) => ({ ...r, done: Math.min(r.done, r.goal) }));
  const goal = rows.reduce((x, r) => x + r.goal, 0);
  const done = rows.reduce((x, r) => x + r.done, 0);
  return { rows, goal, done, pct: goal ? Math.round((done / goal) * 100) : 0 };
}

export async function dashboard(user) {
  const db = await getDb();
  const tz = (await getSettings(user.id))?.timezone || 'Asia/Seoul';
  const today = localDate(tz);
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));

  const [stats, last, weekRows, sessionRows, studyDays, prof, lessons, progress, goal] = await Promise.all([
    db.get('SELECT * FROM user_stats WHERE user_id = ?', user.id),
    // 이어서 학습하기: 가장 최근 학습의 과. 없으면 1과
    db.get("SELECT lesson_ids FROM study_sessions WHERE user_id = ? AND lesson_ids != '' ORDER BY ended_at DESC LIMIT 1", user.id),
    // 최근 7일 경험치 (오늘 포함)
    db.all('SELECT date, xp_earned FROM daily_activity WHERE user_id = ? AND date >= ?', user.id, days[0]),
    db.all('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY ended_at DESC LIMIT 5', user.id),
    db.get('SELECT COUNT(*) n FROM daily_activity WHERE user_id = ? AND xp_earned > 0', user.id),
    profile(user),
    allLessons(),
    progressByLesson(user.id),
    todayGoal(user.id, today),
  ]);
  const continueLesson = parseInt(String(last?.lesson_ids || '1').split(',')[0], 10) || 1;
  const xpByDay = Object.fromEntries(weekRows.map((r) => [r.date, r.xp_earned]));
  const sessions = sessionRows.map((s) => ({
    mode: s.mode,
    lessons: s.lesson_ids ? s.lesson_ids.split(',').map(Number) : [],
    endedAt: s.ended_at,
    items: s.item_count,
    acc: s.item_count ? Math.round((s.first_try_correct / s.item_count) * 100) : 0,
    sec: Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 1000),
    xp: s.xp_earned,
  }));

  return {
    today,
    profile: prof,
    lessons,
    progress,
    steps: STEPS.map((s) => s.key),
    continueLesson,
    goal,
    stats: { xp: stats.xp_total, streak: liveStreak(stats, today), days: studyDays.n },
    week: days.map((d) => ({ date: d, xp: xpByDay[d] || 0 })),
    sessions,
  };
}

// 하루 목표 10/20/30: 지금 저장된 단어·문법·문장 비율대로 나눠 저장
export async function setDailyGoal(userId, total) {
  const db = await getDb();
  const g = await db.get('SELECT * FROM user_goals WHERE user_id = ?', userId);
  let ratio = [g.goal_word, g.goal_gram, g.goal_sent];
  if (!ratio.some(Boolean)) ratio = [1, 1, 1];
  const sum = ratio.reduce((a, b) => a + b, 0);
  const w = Math.round((total * ratio[0]) / sum);
  const gr = Math.round((total * ratio[1]) / sum);
  await db.run(
    "UPDATE user_goals SET goal_word = ?, goal_gram = ?, goal_sent = ?, updated_at = datetime('now') WHERE user_id = ?",
    w, gr, total - w - gr, userId
  );
}

// 학습 기록 초기화: 기록·오답·XP·연속을 지우고 데나리온·보유 상품은 남김
export async function resetRecords(userId) {
  await (await getDb()).transaction(async (db) => {
    for (const t of ['lesson_progress', 'study_sessions', 'daily_activity', 'wrong_notes']) await db.run(`DELETE FROM ${t} WHERE user_id = ?`, userId);
    await db.run('UPDATE user_stats SET xp_total = 0, streak_current = 0, streak_best = 0, last_study_date = NULL WHERE user_id = ?', userId);
  });
}
