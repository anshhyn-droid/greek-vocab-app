// 학습 홈·과 메뉴가 읽는 값: 오늘의 목표, 과별 진도, 이어서 할 회차 (steps/step04_home.md)
import { getDb } from '../db.js';
import { bad, body, json } from '../http.js';
import { requireUser } from '../session.js';
import { STUDY_TYPES, localDate, timezoneOf } from '../user.js';

export async function home(req: Request) {
  const { user } = await requireUser(req);
  const db = await getDb();
  const today = localDate(await timezoneOf(db, user.id));
  const [goals, act, progress, runs] = await Promise.all([
    db.get<{ goal_word: number; goal_gram: number; goal_sent: number }>('SELECT goal_word, goal_gram, goal_sent FROM user_goals WHERE user_id = ?', user.id),
    db.get<{ word_done: number; gram_done: number; sent_done: number }>('SELECT word_done, gram_done, sent_done FROM daily_activity WHERE user_id = ? AND date = ?', user.id, today),
    db.all<{ lesson_id: number; type: string; status: string }>('SELECT lesson_id, type, status FROM lesson_progress WHERE user_id = ?', user.id),
    // 이어서 할 학습(7일 보관). 만료된 것은 빼고 최근 것부터
    db.all<{ lesson_ids: string; type: string; passed_count: number; item_total: number; updated_at: string }>(
      `SELECT lesson_ids, type, passed_count, item_total, updated_at FROM study_runs
       WHERE user_id = ? AND kind = 'study' AND status = 'in_progress' AND (expires_at IS NULL OR expires_at > ?) ORDER BY updated_at DESC`,
      user.id, new Date().toISOString(),
    ),
  ]);
  const prog: Record<number, Record<string, string>> = {};
  for (const p of progress) (prog[p.lesson_id] ||= {})[p.type] = p.status;
  return json({
    today,
    goal: { word: goals?.goal_word ?? 8, gram: goals?.goal_gram ?? 4, sent: goals?.goal_sent ?? 8 },
    done: { word: act?.word_done ?? 0, gram: act?.gram_done ?? 0, sent: act?.sent_done ?? 0 },
    progress: prog,
    runs: runs.map((r) => ({ lesson: Number(r.lesson_ids), type: r.type, at: r.passed_count, of: r.item_total, updatedAt: r.updated_at })),
  });
}

// 종류별 하루 목표 { word, gram, sent } (0~50)
export async function setGoals(req: Request) {
  const { user } = await requireUser(req);
  const b = await body(req);
  const v = (k: string) => {
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < 0 || n > 50) throw bad('goal');
    return n;
  };
  const [w, g, s] = [v('word'), v('gram'), v('sent')];
  await (await getDb()).run(
    'INSERT INTO user_goals (user_id, goal_word, goal_gram, goal_sent, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET goal_word = excluded.goal_word, goal_gram = excluded.goal_gram, goal_sent = excluded.goal_sent, updated_at = excluded.updated_at',
    user.id, w, g, s, new Date().toISOString(),
  );
  return json({ word: w, gram: g, sent: s });
}

// 과 메뉴 "기록 지우기": 이 과의 완료 기록과 이어서 하기를 지움
export async function clearLesson(req: Request) {
  const { user } = await requireUser(req);
  const n = Number(new URL(req.url).searchParams.get('lesson'));
  if (!Number.isInteger(n) || n < 1 || n > 26) throw bad('lesson');
  const db = await getDb();
  await db.tx(async (tx) => {
    await tx.run(`DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ? AND type IN (${STUDY_TYPES.map(() => '?').join(',')})`, user.id, n, ...STUDY_TYPES);
    await tx.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE user_id = ? AND kind = 'study' AND status = 'in_progress' AND lesson_ids = ?", new Date().toISOString(), user.id, String(n));
  });
  return json({ ok: true });
}
