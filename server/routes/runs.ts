// 학습·테스트 회차 (study_runs). 이어서 하기·오답 노트·오늘의 목표·결과·경험치
// 공통 규칙: 진도 N = 완전히 통과한 문항 / 오답 노트는 한 회차에 한 문항 한 번 / 다른 회차에서 연속 2번 한 번에 맞히면 졸업
//            경험치·학습 기록·소요 시간은 끝까지 마쳤을 때만 / 이어서 하기는 학습만(7일)
import crypto from 'node:crypto';
import { getDb, type Db } from '../db.js';
import { HttpError, bad, body, json } from '../http.js';
import { requireUser } from '../session.js';
import { contentVersion, grade, lessonOfItem } from '../content.js';
import { computeReward } from '../reward.js';
import { localDate, timezoneOf } from '../user.js';

const KEEP_MS = 7 * 864e5;
const STUDY_TYPES = ['word', 'gram', 'sent'];
const TEST_TYPES = ['mix', 'flash'];
const ITEM_TYPES = ['word', 'gram', 'sent'];

interface RunRow {
  id: string; user_id: string; kind: string; type: string; lesson_ids: string; status: string; queue: string;
  item_total: number; passed_count: number; first_try_correct: number; extra_state: string | null; elapsed_ms: number;
  rev: number; xp_earned: number; expires_at: string | null; test_options: string | null; started_at: string; content_version: string;
}
const out = (r: RunRow) => ({
  id: r.id, kind: r.kind, type: r.type, lessons: r.lesson_ids.split(',').map(Number), status: r.status,
  queue: JSON.parse(r.queue), itemTotal: r.item_total, passed: r.passed_count, firstTry: r.first_try_correct,
  extra: r.extra_state ? publicExtra(JSON.parse(r.extra_state)) : null, elapsedMs: r.elapsed_ms, rev: r.rev,
});
// 서버만 쓰는 값(_srv)은 화면에 보내지 않음
const publicExtra = (e: Record<string, unknown>) => {
  const { _srv, ...rest } = e;
  void _srv;
  return rest;
};
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const baseId = (id: string) => id.split('#')[0]; // 단어 2바퀴: "W301#2"

async function getRun(db: Db, userId: string, id: string): Promise<RunRow> {
  const r = await db.get<RunRow>('SELECT * FROM study_runs WHERE id = ? AND user_id = ?', id, userId);
  if (!r) throw new HttpError(404, 'run');
  return r;
}

// 시작: 학습은 같은 과·종류의 이어서 할 회차가 있으면 그대로 돌려줌 (restart: 처음부터)
// { kind, type, lessons:[n], queue:[문항 id], itemTotal, extra?, options?, restart? }
export async function startRun(req: Request) {
  const { user } = await requireUser(req);
  const b = await body<{ kind: string; type: string; lessons: number[]; queue: string[]; itemTotal: number; extra?: unknown; options?: unknown; restart?: boolean }>(req);
  const kind = b.kind;
  if (kind !== 'study' && kind !== 'test') throw bad('kind');
  if (!(kind === 'study' ? STUDY_TYPES : TEST_TYPES).includes(b.type)) throw bad('type');
  const lessons = (Array.isArray(b.lessons) ? b.lessons : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 26);
  if (!lessons.length || (kind === 'study' && lessons.length !== 1)) throw bad('lessons');
  const db = await getDb();
  const lessonKey = lessons.join(',');
  const now = Date.now();

  // 지난 이어서 하기: 7일 지난 것은 버림
  await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE user_id = ? AND status = 'in_progress' AND expires_at IS NOT NULL AND expires_at <= ?", iso(now), user.id, iso(now));
  // 테스트는 항상 처음부터: 나가 있던 테스트는 abandoned
  if (kind === 'test') await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE user_id = ? AND kind = 'test' AND status = 'in_progress'", iso(now), user.id);
  if (kind === 'study') {
    const cur = await db.get<RunRow>("SELECT * FROM study_runs WHERE user_id = ? AND kind = 'study' AND type = ? AND lesson_ids = ? AND status = 'in_progress' ORDER BY updated_at DESC LIMIT 1", user.id, b.type, lessonKey);
    if (cur && !b.restart && cur.content_version === contentVersion(lessons)) return json({ run: out(cur), resumed: true });
    if (cur) await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE id = ?", iso(now), cur.id);
  }

  const queue = Array.isArray(b.queue) ? b.queue.map(String).slice(0, 2000) : [];
  if (!queue.length) throw bad('queue');
  // 실제로 있는 문항만 (테스트 플래시 카드는 단어)
  const itemType = kind === 'study' ? b.type : null;
  for (const q of new Set(queue.map(baseId))) {
    const [t, id] = itemType ? [itemType, q] : q.split(':');
    if (!ITEM_TYPES.includes(t) || lessonOfItem(t, id) == null) throw bad('item');
  }
  const id = crypto.randomUUID();
  const total = Math.max(1, Math.min(2000, Number(b.itemTotal) || queue.length));
  await db.run(
    `INSERT INTO study_runs (id, user_id, kind, type, lesson_ids, test_options, content_version, status, queue, item_total, extra_state, started_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?)`,
    id, user.id, kind, b.type, lessonKey, b.options ? JSON.stringify(b.options) : null, contentVersion(lessons),
    JSON.stringify(queue), total, b.extra ? JSON.stringify(b.extra) : null, iso(now), iso(now), kind === 'study' ? iso(now + KEEP_MS) : null,
  );
  if (kind === 'study') {
    await db.run(
      "INSERT INTO lesson_progress (user_id, lesson_id, type, status) VALUES (?, ?, ?, 'in_progress') ON CONFLICT(user_id, lesson_id, type) DO UPDATE SET status = CASE WHEN lesson_progress.status = 'done' THEN 'done' ELSE 'in_progress' END",
      user.id, lessons[0], b.type,
    );
  }
  return json({ run: out(await getRun(db, user.id, id)), resumed: false });
}

interface Answer { seq: number; type: string; id: string; answer: string; passed?: boolean; answeredAt?: string }

// 저장(문항이 바뀔 때마다): { rev, queue, passed, firstTry, extra, elapsedMs, answers:[…] }
// rev가 다르면 다른 탭·기기의 저장이 더 새로우므로 거절(409)하고 지금 상태를 돌려줌
export async function saveRun(req: Request, runId: string) {
  const { user } = await requireUser(req);
  const b = await body<{ rev: number; queue: string[]; passed: number; firstTry: number; extra?: Record<string, unknown>; elapsedMs: number; answers?: Answer[] }>(req);
  const db = await getDb();
  const result = await db.tx(async (tx) => {
    const r = await getRun(tx, user.id, runId);
    if (r.status !== 'in_progress') throw new HttpError(409, 'ended');
    if (Number(b.rev) !== r.rev) return { conflict: out(r) };
    const srv = (r.extra_state ? JSON.parse(r.extra_state)._srv : null) || { reviewHits: 0, firstTry: 0, seen: [] as string[] };
    const tz = await timezoneOf(tx, user.id);
    const today = localDate(tz);
    const goalAdd: Record<string, number> = { word: 0, gram: 0, sent: 0 };
    const toast: string[] = [];
    for (const a of (Array.isArray(b.answers) ? b.answers : []).slice(0, 200)) {
      const seq = Number(a.seq);
      if (!Number.isInteger(seq) || !ITEM_TYPES.includes(a.type) || typeof a.id !== 'string') continue;
      const bid = baseId(a.id);
      const lesson = lessonOfItem(a.type, bid);
      if (lesson == null) continue;
      const correct = grade(a.type, bid, String(a.answer ?? ''));
      const key = a.type + ':' + a.id; // 바퀴 포함: 한 번에 맞힘은 바퀴마다
      const firstOfItem = !srv.seen.includes(key);
      const ins = await tx.run(
        'INSERT OR IGNORE INTO answer_log (run_id, seq, user_id, item_type, item_id, answer, correct, first_try, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        runId, seq, user.id, a.type, a.id, String(a.answer ?? '').slice(0, 300), correct ? 1 : 0, firstOfItem ? 1 : 0, a.answeredAt || iso(),
      );
      if (!ins.rowsAffected) continue; // 같은 번호 재전송은 무시
      if (firstOfItem) {
        srv.seen.push(key);
        if (correct) srv.firstTry++;
        // 오답 노트: 이 회차에서 이 문항의 처음 결과만 (다시 나온 것을 맞힌 건 세지 않음)
        const baseKey = a.type + ':' + bid;
        if (!srv.seen.includes('note:' + baseKey)) {
          srv.seen.push('note:' + baseKey);
          const n = await tx.get<{ ok_streak: number; last_run_id: string }>('SELECT ok_streak, last_run_id FROM wrong_notes WHERE user_id = ? AND item_type = ? AND item_id = ?', user.id, a.type, bid);
          if (!correct) {
            toast.push(a.id);
            await tx.run(
              `INSERT INTO wrong_notes (user_id, item_type, item_id, lesson_id, wrong_count, ok_streak, last_run_id, last_wrong_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)
               ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET wrong_count = wrong_count + 1, ok_streak = 0, last_run_id = excluded.last_run_id, last_wrong_at = excluded.last_wrong_at`,
              user.id, a.type, bid, lesson, runId, iso(),
            );
          } else if (n && n.last_run_id !== runId) {
            srv.reviewHits++;
            if (n.ok_streak + 1 >= 2) await tx.run('DELETE FROM wrong_notes WHERE user_id = ? AND item_type = ? AND item_id = ?', user.id, a.type, bid);
            else await tx.run('UPDATE wrong_notes SET ok_streak = ok_streak + 1, last_run_id = ? WHERE user_id = ? AND item_type = ? AND item_id = ?', runId, user.id, a.type, bid);
          }
        }
      }
      // 오늘의 목표: 학습은 문항이 통과될 때, 테스트는 한 번에 맞힐 때 (플래시 카드는 단어)
      if (r.kind === 'study' ? a.passed && correct : firstOfItem && correct) goalAdd[a.type]++;
    }
    if (goalAdd.word + goalAdd.gram + goalAdd.sent) {
      await tx.run(
        `INSERT INTO daily_activity (user_id, date, word_done, gram_done, sent_done) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET word_done = word_done + excluded.word_done, gram_done = gram_done + excluded.gram_done, sent_done = sent_done + excluded.sent_done`,
        user.id, today, goalAdd.word, goalAdd.gram, goalAdd.sent,
      );
    }
    const extra = { ...(b.extra && typeof b.extra === 'object' ? b.extra : {}), _srv: srv };
    const queue = Array.isArray(b.queue) ? b.queue.map(String).slice(0, 2000) : JSON.parse(r.queue);
    await tx.run(
      'UPDATE study_runs SET queue = ?, passed_count = ?, first_try_correct = ?, extra_state = ?, elapsed_ms = ?, rev = rev + 1, updated_at = ?, expires_at = CASE WHEN kind = ? THEN ? ELSE NULL END WHERE id = ?',
      JSON.stringify(queue), Math.max(0, Math.min(r.item_total, Number(b.passed) || 0)), srv.firstTry, JSON.stringify(extra),
      Math.max(r.elapsed_ms, Math.min(6 * 3600e3, Number(b.elapsedMs) || 0)), iso(), 'study', iso(Date.now() + KEEP_MS), runId,
    );
    return { rev: r.rev + 1, wrongNoted: toast };
  });
  if ('conflict' in result) return json({ error: 'conflict', run: result.conflict }, 409);
  return json(result);
}

// 끝: 경험치(서버 계산)·학습 기록·소요 시간·진도·연속 학습 저장
export async function finishRun(req: Request, runId: string) {
  const { user } = await requireUser(req);
  const b = await body<{ elapsedMs?: number }>(req);
  const db = await getDb();
  const res = await db.tx(async (tx) => {
    const r = await getRun(tx, user.id, runId);
    if (r.status === 'done') throw new HttpError(409, 'ended');
    if (r.status !== 'in_progress') throw new HttpError(409, 'ended');
    const srv = (r.extra_state ? JSON.parse(r.extra_state)._srv : null) || { reviewHits: 0, firstTry: 0 };
    const tz = await timezoneOf(tx, user.id);
    const today = localDate(tz);
    const nowIso = iso();
    // 오늘(사용자 시간대) 같은 종류를 끝낸 횟수 + 1 → 반복 감소
    const recent = await tx.all<{ ended_at: string }>("SELECT ended_at FROM study_runs WHERE user_id = ? AND type = ? AND status = 'done' AND ended_at >= ?", user.id, r.type, iso(Date.now() - 2 * 864e5));
    const sessionNo = recent.filter((x) => localDate(tz, new Date(x.ended_at)) === today).length + 1;
    const firstTry = Math.min(srv.firstTry, r.item_total);
    const reward = computeReward(r.type, r.item_total, firstTry, sessionNo, srv.reviewHits);
    const elapsed = Math.max(r.elapsed_ms, Math.min(6 * 3600e3, Number(b.elapsedMs) || 0));
    await tx.run("UPDATE study_runs SET status = 'done', ended_at = ?, updated_at = ?, xp_earned = ?, elapsed_ms = ?, passed_count = item_total, first_try_correct = ?, expires_at = NULL WHERE id = ?", nowIso, nowIso, reward.total, elapsed, firstTry, runId);
    if (r.kind === 'study') {
      await tx.run(
        `INSERT INTO lesson_progress (user_id, lesson_id, type, status, completed_at, completed_count) VALUES (?, ?, ?, 'done', ?, 1)
         ON CONFLICT(user_id, lesson_id, type) DO UPDATE SET status = 'done', completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at), completed_count = lesson_progress.completed_count + 1`,
        user.id, Number(r.lesson_ids), r.type, nowIso,
      );
    }
    await tx.run(
      `INSERT INTO daily_activity (user_id, date, xp_earned, study_ms, test_items) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET xp_earned = xp_earned + excluded.xp_earned, study_ms = study_ms + excluded.study_ms, test_items = test_items + excluded.test_items`,
      user.id, today, reward.total, elapsed, r.kind === 'test' ? r.item_total : 0,
    );
    // 누적 경험치·학습한 날·연속 학습
    const st = (await tx.get<{ xp_total: number; streak_current: number; streak_best: number; study_days: number; last_study_date: string | null }>('SELECT * FROM user_stats WHERE user_id = ?', user.id)) || { xp_total: 0, streak_current: 0, streak_best: 0, study_days: 0, last_study_date: null };
    const yesterday = localDate(tz, new Date(Date.now() - 864e5));
    const newDay = st.last_study_date !== today;
    const streak = newDay ? (st.last_study_date === yesterday ? st.streak_current + 1 : 1) : st.streak_current;
    await tx.run(
      `INSERT INTO user_stats (user_id, xp_total, streak_current, streak_best, study_days, last_study_date) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET xp_total = excluded.xp_total, streak_current = excluded.streak_current, streak_best = excluded.streak_best, study_days = excluded.study_days, last_study_date = excluded.last_study_date`,
      user.id, st.xp_total + reward.total, streak, Math.max(st.streak_best, streak), st.study_days + (newDay ? 1 : 0), today,
    );
    return { reward, itemTotal: r.item_total, firstTry, elapsedMs: elapsed, xpBefore: st.xp_total, xpAfter: st.xp_total + reward.total };
  });
  return json(res);
}

// 테스트 중간에 나감: 경험치·기록 없이 abandoned (틀린 문항은 오답 노트에 이미 남음)
export async function abandonRun(req: Request, runId: string) {
  const { user } = await requireUser(req);
  const db = await getDb();
  await db.run("UPDATE study_runs SET status = 'abandoned', ended_at = ? WHERE id = ? AND user_id = ? AND status = 'in_progress' AND kind = 'test'", iso(), runId, user.id);
  return json({ ok: true });
}

// ── 책갈피 ──
const BM_TYPES = ['word', 'gram', 'sent', 'concept'];
export async function listBookmarks(req: Request) {
  const { user } = await requireUser(req);
  const rows = await (await getDb()).all('SELECT item_type, item_id, lesson_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC', user.id);
  return json(rows.map((r) => ({ type: r.item_type, id: r.item_id, lesson: r.lesson_id, at: r.created_at })));
}
// 누르면 담고, 다시 누르면 빠짐 (즉시 저장) { type, id }
export async function toggleBookmark(req: Request) {
  const { user } = await requireUser(req);
  const b = await body<{ type: string; id: string }>(req);
  if (!BM_TYPES.includes(b.type) || typeof b.id !== 'string') throw bad('item');
  const lesson = lessonOfItem(b.type, b.id);
  if (lesson == null) throw bad('item');
  const db = await getDb();
  const on = await db.get('SELECT 1 FROM bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ?', user.id, b.type, b.id);
  if (on) await db.run('DELETE FROM bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ?', user.id, b.type, b.id);
  else await db.run('INSERT INTO bookmarks (user_id, item_type, item_id, lesson_id) VALUES (?, ?, ?, ?)', user.id, b.type, b.id, lesson);
  return json({ type: b.type, id: b.id, on: !on });
}

// ── 오답 노트 목록 (테스트 탭) ──
export async function listNotes(req: Request) {
  const { user } = await requireUser(req);
  const rows = await (await getDb()).all<{ item_type: string; item_id: string; lesson_id: number; wrong_count: number; ok_streak: number }>(
    'SELECT item_type, item_id, lesson_id, wrong_count, ok_streak FROM wrong_notes WHERE user_id = ? ORDER BY wrong_count DESC, last_wrong_at DESC', user.id,
  );
  return json(rows.map((r) => ({ type: r.item_type, id: r.item_id, lesson: r.lesson_id, wrong: r.wrong_count, ok: r.ok_streak })));
}
