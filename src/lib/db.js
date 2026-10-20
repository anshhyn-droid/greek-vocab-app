import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';

// 배포: TURSO_DATABASE_URL(+ TURSO_AUTH_TOKEN)의 Turso DB
// 개발: 그 값이 없으면 data/db.sqlite 파일
const dataDir = path.join(process.cwd(), 'data');

const plain = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

// get(sql, ...args) → 첫 행 또는 undefined, all → 행 배열, run → 결과
function wrap(exec) {
  return {
    get: async (sql, ...args) => plain(await exec({ sql, args }))[0],
    all: async (sql, ...args) => plain(await exec({ sql, args })),
    run: (sql, ...args) => exec({ sql, args }),
  };
}

// 이미 만들어진 DB를 지금 schema.sql에 맞춤 (CREATE IF NOT EXISTS는 열을 더하지 않음)
async function migrate(client) {
  const cols = (await client.execute('PRAGMA table_info(auth_sessions)')).rows.map((r) => r.name);
  if (!cols.includes('idle_expires_at')) await client.execute('ALTER TABLE auth_sessions ADD COLUMN idle_expires_at TEXT');
  // 프로필 사진은 저장하지 않음 (보안·개인정보 명세 1)
  await client.execute('UPDATE users SET avatar_url = NULL WHERE avatar_url IS NOT NULL');
}

async function open() {
  const url = process.env.TURSO_DATABASE_URL;
  const client = createClient(
    url ? { url, authToken: process.env.TURSO_AUTH_TOKEN } : { url: 'file:' + path.join(dataDir, 'db.sqlite') }
  );
  if (!url) await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');
  await client.executeMultiple(fs.readFileSync(path.join(dataDir, 'schema.sql'), 'utf8'));
  await migrate(client);
  const db = wrap((stmt) => client.execute(stmt));
  // transaction(async (tx) => …): tx도 get·all·run. 오류가 나면 모두 되돌림
  db.transaction = async (fn) => {
    const t = await client.transaction('write');
    try {
      const out = await fn(wrap((stmt) => t.execute(stmt)));
      await t.commit();
      return out;
    } finally {
      t.close();
    }
  };
  return db;
}

// 개발 서버가 모듈을 다시 불러와도 연결은 하나만 유지
export function getDb() {
  if (!globalThis.__gkDb) globalThis.__gkDb = open().catch((e) => ((globalThis.__gkDb = null), Promise.reject(e)));
  return globalThis.__gkDb;
}
