import crypto from 'crypto';
import { getDb } from './db';
import { CONSENT_TYPES, CONSENT_VERSION } from './consent';

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const NAME_MAX = 20;

// 이름: 제어 문자를 빼고 앞뒤 공백 정리, 최대 20자. 비면 ''
export function cleanName(v) {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

// yo*******@gmail.com — 앞 두 글자만
export function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '';
  return local.slice(0, 2) + '*'.repeat(Math.max(1, local.length - 2)) + '@' + domain;
}

async function newInviteCode(db) {
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!(await db.get('SELECT 1 FROM users WHERE invite_code = ?', code))) return code;
  }
}

// 이미 가입한 사용자면 이메일·마지막 로그인을 갱신하고 id, 아니면 null
// 프로필 사진과 이름은 받지 않음 (이름은 사용자가 바꿀 수 있으므로 가입 때만 씀)
export async function findGoogleUser({ sub, email }) {
  const db = await getDb();
  const found = await db.get('SELECT id FROM users WHERE google_sub = ? AND deleted_at IS NULL', sub);
  if (!found) return null;
  await db.run("UPDATE users SET email = ?, last_login_at = datetime('now') WHERE id = ?", email, found.id);
  return found.id;
}

export async function saveConsents(db, userId) {
  for (const t of CONSENT_TYPES) {
    await db.run('INSERT OR REPLACE INTO user_consents (user_id, type, version, agreed, agreed_at) VALUES (?, ?, ?, 1, ?)', userId, t, CONSENT_VERSION, new Date().toISOString());
  }
}

// 약관 동의를 마친 새 사용자 가입: 사용자 + 기본 행 + 동의 기록을 한 번에
export async function createUser(db, { sub, email, name }) {
  const id = crypto.randomUUID();
  await db.run(
    'INSERT INTO users (id, google_sub, email, display_name, invite_code) VALUES (?, ?, ?, ?, ?)',
    id, sub, email, cleanName(name) || cleanName(email.split('@')[0]) || '학습자', await newInviteCode(db)
  );
  await db.run('INSERT INTO user_settings (user_id) VALUES (?)', id);
  await db.run('INSERT INTO user_goals (user_id) VALUES (?)', id);
  await db.run('INSERT INTO user_stats (user_id) VALUES (?)', id);
  // 기본 테마(토기)
  await db.run("INSERT INTO user_items (user_id, item_id, item_type) VALUES (?, 'clay', 'theme')", id);
  await saveConsents(db, id);
  return id;
}

// 탈퇴: 사용자와 연결된 모든 행 삭제. 접속 기록만 user_id를 비우고 남김(3개월 뒤 삭제)
const USER_TABLES = [
  'auth_sessions', 'user_consents', 'user_settings', 'user_goals', 'user_stats', 'daily_activity', 'lesson_progress',
  'study_sessions', 'wrong_notes', 'favorites', 'coin_ledger', 'user_items', 'weekly_rankings',
];
export async function deleteUser(db, userId) {
  for (const t of USER_TABLES) await db.run(`DELETE FROM ${t} WHERE user_id = ?`, userId);
  await db.run('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?', userId, userId);
  await db.run('UPDATE access_logs SET user_id = NULL WHERE user_id = ?', userId);
  await db.run('DELETE FROM users WHERE id = ?', userId);
}

export async function getSettings(userId) {
  return (await getDb()).get('SELECT * FROM user_settings WHERE user_id = ?', userId);
}

export const GREEK_SCALE = { m: 1, l: 1.2, xl: 1.4 };
