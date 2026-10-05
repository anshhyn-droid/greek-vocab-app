import crypto from 'crypto';
import { getDb } from './db';

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function newInviteCode(db) {
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!(await db.get('SELECT 1 FROM users WHERE invite_code = ?', code))) return code;
  }
}

// Google 로그인 결과로 사용자를 찾거나 새로 만듦. 첫 로그인이면 기본 행들을 함께 생성
export async function upsertGoogleUser({ sub, email, name, picture }) {
  return (await getDb()).transaction(async (db) => {
    const found = await db.get('SELECT * FROM users WHERE google_sub = ?', sub);
    if (found) {
      await db.run("UPDATE users SET email = ?, avatar_url = ?, last_login_at = datetime('now') WHERE id = ?", email, picture || null, found.id);
      return found.id;
    }
    const id = crypto.randomUUID();
    await db.run(
      'INSERT INTO users (id, google_sub, email, display_name, avatar_url, invite_code) VALUES (?, ?, ?, ?, ?, ?)',
      id, sub, email, name || email.split('@')[0], picture || null, await newInviteCode(db)
    );
    await db.run('INSERT INTO user_settings (user_id) VALUES (?)', id);
    await db.run('INSERT INTO user_goals (user_id) VALUES (?)', id);
    await db.run('INSERT INTO user_stats (user_id) VALUES (?)', id);
    // 기본 테마(토기)
    await db.run("INSERT INTO user_items (user_id, item_id, item_type) VALUES (?, 'clay', 'theme')", id);
    return id;
  });
}

export async function getSettings(userId) {
  return (await getDb()).get('SELECT * FROM user_settings WHERE user_id = ?', userId);
}

export const GREEK_SCALE = { m: 1, l: 1.2, xl: 1.4 };
