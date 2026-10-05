// 학습·암기 완료 기록 (서버 전용). 결과 카드의 보상은 여기서 계산한 값만 씀
import crypto from 'crypto';
import { getDb } from './db';
import { getSettings } from './users';
import { computeReward } from './reward';
import { localDate, addDays } from './time';
import { lessonNum } from './lesson';
import { badRequest } from './auth';

const MODES = ['word', 'gram', 'sent', 'review', 'ox', 'note'];
const STUDY_TYPE = { word: 'word', gram: 'gram', sent: 'sent' }; // 과 학습 → lesson_progress.type
const ITEM_TABLE = {
  word: ['words', 'word_id'],
  gram: ['grammar_questions', 'question_id'],
  sent: ['sentences', 'example_id'],
};

// 어제나 오늘 학습했을 때만 연속이 이어지고 있음
export function liveStreak(stats, today) {
  if (!stats?.last_study_date) return 0;
  return stats.last_study_date === today || stats.last_study_date === addDays(today, -1) ? stats.streak_current : 0;
}

/**
 * @param payload {
 *   mode: 'word'|'gram'|'sent'|'review'|'ox'|'note',
 *   durationSec: number,
 *   items: [{ id, type: 'word'|'gram'|'sent', round?: 1|2, firstTry: boolean }],
 *   ox?: { known, unknown }
 * }
 * items는 처음 답한 문항마다 한 번씩 (다시 푼 것은 넣지 않음). 단어 학습은 라운드마다 한 번
 */
export async function completeSession(user, payload) {
  const { mode, durationSec, items, ox } = payload || {};
  if (!MODES.includes(mode)) throw badRequest('mode');
  if (!Array.isArray(items) || !items.length || items.length > 1000) throw badRequest('items');

  // 실제로 있는 문항의 과 (종류마다 한 번에 조회)
  const lessonOf = {};
  for (const [type, [table, pk]] of Object.entries(ITEM_TABLE)) {
    const ids = [...new Set(items.filter((it) => it && it.type === type && typeof it.id === 'string').map((it) => it.id))];
    if (!ids.length) continue;
    const rows = await (await getDb()).all(`SELECT ${pk} AS id, lesson_id FROM ${table} WHERE ${pk} IN (${ids.map(() => '?').join(',')})`, ...ids);
    for (const r of rows) lessonOf[type + r.id] = r.lesson_id;
  }

  // (종류·id·라운드)마다 한 번
  const seen = new Set();
  const valid = [];
  for (const it of items) {
    const type = it && it.type;
    if (!ITEM_TABLE[type] || typeof it.id !== 'string') continue;
    if (STUDY_TYPE[mode] && type !== mode) continue;
    const key = type + ':' + it.id + ':' + (it.round || 1);
    if (seen.has(key) || !lessonOf[type + it.id]) continue;
    seen.add(key);
    valid.push({ id: it.id, type, firstTry: !!it.firstTry, lesson: lessonNum(lessonOf[type + it.id]) });
  }
  if (!valid.length) throw badRequest('items');

  const settings = await getSettings(user.id);
  const tz = settings?.timezone || 'Asia/Seoul';
  const now = new Date();
  const today = localDate(tz, now);
  const dur = Math.min(6 * 3600, Math.max(1, Math.round(Number(durationSec) || 1)));
  const lessons = [...new Set(valid.map((v) => v.lesson))].sort((a, b) => a - b);
  const itemCount = valid.length;
  const firstTry = valid.filter((v) => v.firstTry).length;

  return (await getDb()).transaction(async (db) => {
    const sessionNo =
      (await db.get('SELECT COUNT(*) n FROM study_sessions WHERE user_id = ? AND mode = ? AND local_date = ?', user.id, mode, today)).n + 1;

    // C. 복습 보너스: 오답 노트에 있던 문항을 이번에 (모든 출제에서) 한 번에 맞힘
    const notes = new Map((await db.all('SELECT * FROM wrong_notes WHERE user_id = ?', user.id)).map((n) => [n.item_id, n]));
    const byId = new Map();
    for (const v of valid) byId.set(v.id, (byId.get(v.id) ?? true) && v.firstTry);
    const reviewHits = [...byId].filter(([id, ok]) => ok && notes.has(id)).length;

    const reward = computeReward({ mode, itemCount, firstTry, sessionNo, reviewHits });

    // 오답 노트: 틀리면 wrong_count+1·streak 0, 한 번에 맞히면 streak+1, 2가 되면 삭제
    for (const v of valid) {
      const n = notes.get(v.id);
      if (!v.firstTry) {
        if (n) await db.run("UPDATE wrong_notes SET wrong_count = wrong_count + 1, streak_correct = 0, last_wrong_at = datetime('now') WHERE user_id = ? AND item_id = ?", user.id, v.id);
        else await db.run('INSERT INTO wrong_notes (user_id, item_id, item_type) VALUES (?, ?, ?)', user.id, v.id, v.type);
        notes.set(v.id, { streak_correct: 0 });
      } else if (n) {
        if (n.streak_correct + 1 >= 2) {
          await db.run('DELETE FROM wrong_notes WHERE user_id = ? AND item_id = ?', user.id, v.id);
          notes.delete(v.id);
        } else {
          await db.run('UPDATE wrong_notes SET streak_correct = streak_correct + 1 WHERE user_id = ? AND item_id = ?', user.id, v.id);
          notes.set(v.id, { ...n, streak_correct: n.streak_correct + 1 });
        }
      }
    }

    const sessionId = crypto.randomUUID();
    await db.run(
      `INSERT INTO study_sessions (id, user_id, mode, lesson_ids, started_at, ended_at, local_date, item_count, first_try_correct, ox_known, ox_unknown, xp_earned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionId, user.id, mode, lessons.join(','), new Date(now.getTime() - dur * 1000).toISOString(), now.toISOString(), today,
      itemCount, firstTry, mode === 'ox' ? ox?.known ?? null : null, mode === 'ox' ? ox?.unknown ?? null : null, reward.total
    );

    // 날짜별 기록: 종류별 푼 문항 수 + 경험치
    const done = { word: 0, gram: 0, sent: 0 };
    for (const v of valid) done[v.type]++;
    await db.run('INSERT OR IGNORE INTO daily_activity (user_id, date) VALUES (?, ?)', user.id, today);
    await db.run(
      `UPDATE daily_activity SET word_done = word_done + ?, gram_done = gram_done + ?, sent_done = sent_done + ?, xp_earned = xp_earned + ?
       WHERE user_id = ? AND date = ?`,
      done.word, done.gram, done.sent, reward.total, user.id, today
    );

    // 누적: 경험치 = 데나리온, 연속 학습
    const st = await db.get('SELECT * FROM user_stats WHERE user_id = ?', user.id);
    let streak = st.streak_current;
    if (st.last_study_date !== today) streak = st.last_study_date === addDays(today, -1) ? streak + 1 : 1;
    const coins = st.coins + reward.total;
    await db.run(
      'UPDATE user_stats SET xp_total = xp_total + ?, coins = ?, streak_current = ?, streak_best = MAX(streak_best, ?), last_study_date = ? WHERE user_id = ?',
      reward.total, coins, streak, streak, today, user.id
    );
    await db.run(
      "INSERT INTO coin_ledger (id, user_id, amount, reason, ref_id, balance_after) VALUES (?, ?, ?, 'lesson_done', ?, ?)",
      crypto.randomUUID(), user.id, reward.total, sessionId, coins
    );

    // 과 학습이면 그 과를 완료로
    if (STUDY_TYPE[mode]) {
      for (const l of lessons) {
        await db.run(
          `INSERT INTO lesson_progress (user_id, lesson_id, type, status, completed_at) VALUES (?, ?, ?, 'done', datetime('now'))
           ON CONFLICT(user_id, lesson_id, type) DO UPDATE SET status = 'done', completed_at = datetime('now')`,
          user.id, l, STUDY_TYPE[mode]
        );
      }
    }

    return {
      sessionId,
      reward,
      itemCount,
      firstTry,
      xpBefore: st.xp_total,
      xpAfter: st.xp_total + reward.total,
      streak: { before: liveStreak(st, today), after: streak, firstToday: st.last_study_date !== today },
    };
  });
}
