import { withUser, badRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dashboard, setDailyGoal } from '@/lib/dashboard';

const LANGS = { 한국어: 'ko', English: 'en', 日本語: 'ja' };

// 목차·마이페이지에 필요한 값 한 번에
export const GET = withUser(async (_req, user) => Response.json(await dashboard(user)));

// 이름·설정·하루 목표 변경
export const PATCH = withUser(async (request, user) => {
  const b = await request.json();
  const db = await getDb();
  if ('name' in b) {
    const name = String(b.name || '').trim().slice(0, 30);
    if (!name) throw badRequest('name');
    await db.run('UPDATE users SET display_name = ? WHERE id = ?', name, user.id);
  }
  const set = (col, v) => db.run(`UPDATE user_settings SET ${col} = ?, updated_at = datetime('now') WHERE user_id = ?`, v, user.id);
  if ('lang' in b) { if (!Object.values(LANGS).includes(b.lang)) throw badRequest('lang'); await set('ui_lang', b.lang); }
  if ('mode' in b) { if (!['light', 'dark'].includes(b.mode)) throw badRequest('mode'); await set('theme_mode', b.mode); }
  if ('greekSize' in b) { if (!['m', 'l', 'xl'].includes(b.greekSize)) throw badRequest('greekSize'); await set('greek_size', b.greekSize); }
  if ('remind' in b) await set('remind_on', b.remind ? 1 : 0);
  if ('sound' in b) await set('sound_on', b.sound ? 1 : 0);
  if ('goal' in b) { if (![10, 20, 30].includes(b.goal)) throw badRequest('goal'); await setDailyGoal(user.id, b.goal); }
  const fresh = await db.get('SELECT * FROM users WHERE id = ?', user.id);
  return Response.json(await dashboard(fresh));
});
