// 엑셀 → SQLite
// 사용법: node data/seed.js [엑셀 경로]
// TURSO_DATABASE_URL·TURSO_AUTH_TOKEN이 있으면 Turso DB에, 없으면 data/db.sqlite에 넣습니다.
// 콘텐츠 테이블(lessons, words, grammar_questions, sentences, sentence_parsing)은 매번 새로 만들고,
// 사용자 테이블(schema.sql)은 없을 때만 만듭니다. 열 이름은 엑셀 머리글을 그대로 씁니다.
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@libsql/client');

const excelPath = path.resolve(process.argv[2] || path.join(__dirname, '../../제3과_헬라어_학습DB.xlsx'));
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:' + path.join(__dirname, 'db.sqlite');

// 시트별 기본키와 버릴 열
const SHEETS = {
  words: { pk: 'word_id', skip: ['1열'] },
  grammar_questions: { pk: 'question_id' },
  sentences: { pk: 'example_id' },
  sentence_parsing: { pk: 'parsing_id' },
};

// 과 목록. 엑셀에 과 시트가 생기면 그 시트에서 읽도록 바꿉니다.
const LESSON_COUNT = 28;
const LESSONS = {
  3: { title: '동사의 기초', summary: '단어를 익히고, 문법을 확인한 뒤, 연습 문장을 해석하고 파싱합니다.' },
};

const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';

// 셀 값 정리: 빈 칸·"none"은 NULL, 문자열은 앞뒤 공백 제거
function cell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? BigInt(v) : v; // 정수는 INTEGER로
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'none') return null;
  return s;
}

function seedSheet(stmts, wb, name, { pk, skip = [] }) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`엑셀에 "${name}" 시트가 없습니다`);
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const header = rows[0].map((h) => (h == null ? '' : String(h).trim()));
  const cols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h && !skip.includes(h));
  if (!cols.some((c) => c.h === pk)) throw new Error(`"${name}" 시트에 ${pk} 열이 없습니다`);

  stmts.push(`DROP TABLE IF EXISTS ${q(name)}`);
  stmts.push(
    `CREATE TABLE ${q(name)} (_row INTEGER NOT NULL, ` +
      cols.map(({ h }) => (h === pk ? `${q(h)} TEXT PRIMARY KEY` : q(h))).join(', ') +
      ')'
  );
  const insert = `INSERT INTO ${q(name)} (_row, ${cols.map((c) => q(c.h)).join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`;
  let n = 0;
  rows.slice(1).forEach((r, idx) => {
    const vals = cols.map(({ i }) => cell(r[i]));
    if (vals[cols.findIndex((c) => c.h === pk)] == null) return;
    stmts.push({ sql: insert, args: [idx + 1, ...vals] });
    n++;
  });
  console.log(`  ${name}: ${n}행 (${cols.map((c) => c.h).join(', ')})`);
}

function seedLessons(stmts) {
  stmts.push('DROP TABLE IF EXISTS lessons');
  stmts.push('CREATE TABLE lessons (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT, summary TEXT)');
  const sql = 'INSERT INTO lessons (id, code, title, summary) VALUES (?, ?, ?, ?)';
  for (let n = 1; n <= LESSON_COUNT; n++) {
    const l = LESSONS[n] || {};
    stmts.push({ sql, args: [n, 'L' + String(n).padStart(2, '0'), l.title || null, l.summary || null] });
  }
  console.log(`  lessons: ${LESSON_COUNT}행`);
}

async function main() {
  if (!fs.existsSync(excelPath)) {
    console.error('엑셀 파일을 찾을 수 없습니다: ' + excelPath);
    process.exit(1);
  }
  console.log('엑셀: ' + excelPath);
  const wb = xlsx.readFile(excelPath);
  const db = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  await db.executeMultiple(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  // 콘텐츠 표 전체를 한 번에 (중간에 실패하면 모두 되돌림)
  const stmts = [];
  seedLessons(stmts);
  for (const [name, opt] of Object.entries(SHEETS)) seedSheet(stmts, wb, name, opt);
  await db.batch(stmts, 'write');
  db.close();
  console.log('DB: ' + dbUrl.replace(/\?.*$/, ''));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
