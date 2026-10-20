// DB 연결. 배포: TURSO_DATABASE_URL(+ TURSO_AUTH_TOKEN) / 개발: data/local.sqlite 파일
import { createClient, type Client, type InValue, type ResultSet } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

export type Args = InValue[];
export interface Db {
  get<T = Row>(sql: string, ...args: Args): Promise<T | undefined>;
  all<T = Row>(sql: string, ...args: Args): Promise<T[]>;
  run(sql: string, ...args: Args): Promise<ResultSet>;
}
export type Row = Record<string, unknown>;

const plain = (rs: ResultSet) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

function wrap(exec: (sql: string, args: Args) => Promise<ResultSet>): Db {
  return {
    get: async <T>(sql: string, ...args: Args) => plain(await exec(sql, args))[0] as T | undefined,
    all: async <T>(sql: string, ...args: Args) => plain(await exec(sql, args)) as T[],
    run: (sql: string, ...args: Args) => exec(sql, args),
  };
}

let client: Client | null = null;
let ready: Promise<void> | null = null;

function open(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
  return createClient({ url: 'file:' + path.join(process.cwd(), 'data', 'local.sqlite') });
}

// 처음 한 번 표를 만듦 (db/schema.turso.sql, 여러 번 실행해도 됨)
export async function getDb(): Promise<Db & { tx<T>(fn: (db: Db) => Promise<T>): Promise<T> }> {
  client ??= open();
  const c = client;
  ready ??= c
    .executeMultiple(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.turso.sql'), 'utf8'))
    .catch((e) => {
      ready = null;
      throw e;
    });
  await ready;
  return {
    ...wrap((sql, args) => c.execute({ sql, args })),
    // 한 번에: 중간에 실패하면 모두 되돌림
    async tx<T>(fn: (db: Db) => Promise<T>) {
      const t = await c.transaction('write');
      try {
        const out = await fn(wrap((sql, args) => t.execute({ sql, args })));
        await t.commit();
        return out;
      } finally {
        t.close();
      }
    },
  };
}
