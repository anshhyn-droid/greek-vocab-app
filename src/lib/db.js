import Database from 'better-sqlite3';
import path from 'path';

// process.cwd() is the root of the Next.js project
const dbPath = path.join(process.cwd(), 'data', 'db.sqlite');

export function getDb() {
  return new Database(dbPath, { readonly: true });
}
