// 콘텐츠 DB(엑셀에서 넣은 표)를 읽어 화면에 줄 문항을 만듦. 서버 전용
import { getDb } from './db';
import { shuffle } from './shuffle';
import { lessonCode, lessonNum, GRAMMAR_PICK, REVIEW_GRAMMAR_PICK } from './lesson';
import { buildTraps, verbStems, koTokens } from './koTraps';

const inLessons = (nums) => {
  const codes = nums.map(lessonCode);
  return { sql: `lesson_id IN (${codes.map(() => '?').join(',') || "''"})`, args: codes };
};

// ── 단어 ────────────────────────────────────────────────
export async function wordRows(nums) {
  const w = inLessons(nums);
  return (await getDb()).all(`SELECT * FROM words WHERE ${w.sql} ORDER BY _row`, ...w.args);
}

// 보기: 정답 뜻 1 + 같은 과 다른 단어의 뜻 중 무작위 3 (중복 없이, 요청마다 새로)
function meaningChoices(word, sameLesson) {
  const others = [...new Set(sameLesson.filter((x) => x.word_id !== word.word_id).map((x) => x.뜻))].filter(
    (m) => m && m !== word.뜻
  );
  return shuffle([word.뜻, ...shuffle(others).slice(0, 3)]);
}

const wordItem = (w, sameLesson) => ({ id: w.word_id, lesson: lessonNum(w.lesson_id), g: w.단어, m: w.뜻, ch: meaningChoices(w, sameLesson) });

export async function wordQuiz(num) {
  const rows = await wordRows([num]);
  return rows.map((w) => wordItem(w, rows));
}

// ── 문법 ────────────────────────────────────────────────
export async function grammarRows(nums) {
  const w = inLessons(nums);
  return (await getDb()).all(`SELECT * FROM grammar_questions WHERE ${w.sql} ORDER BY _row`, ...w.args);
}

// 보기는 엑셀 번호(k: 1~4)를 지닌 채 보내고, 화면에서 나올 때마다 섞음. 빈 보기는 뺌
function grammarItem(r) {
  const o = [1, 2, 3, 4].map((k) => ({ k, t: r['option_' + k] })).filter((x) => x.t != null && String(x.t).trim() !== '');
  return {
    id: r.question_id,
    lesson: lessonNum(r.lesson_id),
    p: r.prompt,
    t: r.target_form,
    o: o.map((x) => ({ k: x.k, t: String(x.t) })),
    a: Number(r.correct_option),
    e: r.explanation,
    pg: r.source_page,
    lv: r.난이도,
  };
}

// 전체 문항 중 무작위 20개를 무작위 순서로
export async function grammarQuiz(num, pick = GRAMMAR_PICK) {
  return shuffle(await grammarRows([num])).slice(0, pick).map(grammarItem);
}

// ── 문장 ────────────────────────────────────────────────
export async function sentenceRows(nums) {
  const w = inLessons(nums);
  return (await getDb()).all(`SELECT * FROM sentences WHERE ${w.sql} ORDER BY _row`, ...w.args);
}

const GREEK_ENDINGS = ['ω', 'εις', 'ει', 'ομεν', 'ετε', 'ουσι'];
// 비고 열 중 작업용 메모(학습자에게 보이지 않음)
const INTERNAL_NOTES = new Set(['교재 인쇄 문장만 수록']);

// 원형 보기 4개: 같은 동사의 현재 능동 직설법 변화형 중 기본형 1 + 오답 3
// 오답 = 문장 속 형태(기본형과 다를 때) + 다른 인칭·수 형태
function lemmaOptions(lemma, form) {
  const lem = lemma.normalize('NFC');
  const inSent = form.normalize('NFC').toLowerCase();
  if (!lem.endsWith('ω')) return shuffle([...new Set([lem, inSent])]);
  const stem = lem.slice(0, -1);
  const forms = GREEK_ENDINGS.map((e) => stem + e).filter((f) => f !== lem);
  const wrong = forms.includes(inSent)
    ? [inSent, ...shuffle(forms.filter((f) => f !== inSent)).slice(0, 2)]
    : shuffle(forms).slice(0, 3);
  return shuffle([lem, ...wrong]);
}

async function parsingFor(ids) {
  if (!ids.length) return [];
  return (await getDb()).all(`SELECT * FROM sentence_parsing WHERE sentence_id IN (${ids.map(() => '?').join(',')}) ORDER BY _row`, ...ids);
}

async function koStems() {
  const rows = await (await getDb()).all(`SELECT 뜻 FROM sentence_parsing UNION ALL SELECT 뜻 FROM words WHERE 품사 = '동사'`);
  return verbStems(rows.map((r) => r.뜻));
}

function sentenceItem(s, parsing, stems) {
  const tokens = koTokens(s.정답_번역);
  // 함정: 오답_블록 열에 값이 있으면 그 값, 없으면 자동 규칙 (인칭·격 최대 2 + 동사 후보 5개 중 무작위 3)
  const manual = String(s.오답_블록 || '').split(',').map((x) => x.trim()).filter(Boolean);
  let traps = manual;
  if (!manual.length) {
    const auto = buildTraps(tokens, stems);
    traps = [...auto.nounTraps, ...shuffle(auto.verbCandidates).slice(0, 3)];
  }
  traps = [...new Set(traps)].filter((t) => !tokens.includes(t));
  return {
    id: s.example_id,
    lesson: lessonNum(s.lesson_id),
    num: s.번호,
    g: s.문장,
    ko: s.정답_번역,
    note: INTERNAL_NOTES.has(s.비고) ? null : s.비고,
    need: tokens.length,
    koPool: shuffle([...tokens.map((t) => ({ t, ans: true })), ...traps.map((t) => ({ t, ans: false }))]),
    verbs: parsing
      .filter((p) => p.sentence_id === s.example_id)
      .map((p) => ({
        id: p.parsing_id,
        form: p.형태,
        lemma: String(p.기본형).normalize('NFC'),
        mean: p.뜻,
        gloss: p.해석,
        tense: p.시제_id,
        voice: p.태_id,
        mood: p.법_id,
        num: p.수_id,
        person: p.인칭_id,
        lemOpts: lemmaOptions(p.기본형, p.형태),
      })),
  };
}

// 문장은 매번 무작위 순서. 블록과 보기 순서도 요청마다 섞음
export async function sentenceQuiz(num) {
  const rows = await sentenceRows([num]);
  const [parsing, stems] = await Promise.all([parsingFor(rows.map((r) => r.example_id)), koStems()]);
  return shuffle(rows.map((s) => sentenceItem(s, parsing, stems)));
}

// ── 과 정보 ─────────────────────────────────────────────
export async function lessonInfo(num) {
  const db = await getDb();
  const l = await db.get('SELECT * FROM lessons WHERE id = ?', num);
  if (!l) return null;
  const count = async (t) => (await db.get(`SELECT COUNT(*) n FROM ${t} WHERE lesson_id = ?`, l.code)).n;
  const [word, gram, sent] = await Promise.all([count('words'), count('grammar_questions'), count('sentences')]);
  return { id: l.id, title: l.title, summary: l.summary, counts: { word, gram, sent } };
}

export async function allLessons() {
  const db = await getDb();
  const [readyRows, lessons] = await Promise.all([
    db.all('SELECT lesson_id FROM words UNION SELECT lesson_id FROM grammar_questions UNION SELECT lesson_id FROM sentences'),
    db.all('SELECT * FROM lessons ORDER BY id'),
  ]);
  const ready = new Set(readyRows.map((r) => r.lesson_id));
  return lessons.map((l) => ({ id: l.id, title: l.title, ready: ready.has(l.code) }));
}

// ── 암기 ────────────────────────────────────────────────
// 암기 문항: 단어(4지선다) · 문법(과마다 무작위 10) · 문장(해석 4개 중 고르기) · OX(단어)
function reviewWord(w, sameLesson) {
  const { ch, ...rest } = wordItem(w, sameLesson);
  return { t: 'word', ...rest, opts: ch };
}
function reviewGram(r) {
  const it = grammarItem(r);
  return { t: 'gram', id: it.id, lesson: it.lesson, p: it.p, sub: it.t, opts: shuffle(it.o.map((x) => x.t)), ans: (it.o.find((x) => x.k === it.a) || {}).t };
}
function reviewSent(s, sameLesson) {
  const others = shuffle([...new Set(sameLesson.filter((x) => x.example_id !== s.example_id).map((x) => x.정답_번역))].filter((k) => k !== s.정답_번역)).slice(0, 3);
  return { t: 'sent', id: s.example_id, lesson: lessonNum(s.lesson_id), g: s.문장, ans: s.정답_번역, opts: shuffle([s.정답_번역, ...others]) };
}

export async function reviewItems({ lessons = [], modes = [], favOnly = false, note = false }, userId) {
  const db = await getDb();
  const out = [];
  if (note) {
    const notes = await db.all('SELECT item_id, item_type FROM wrong_notes WHERE user_id = ?', userId);
    const byType = (t) => notes.filter((n) => n.item_type === t).map((n) => n.item_id);
    const pick = (table, pk, ids) => (ids.length ? db.all(`SELECT * FROM ${table} WHERE ${pk} IN (${ids.map(() => '?').join(',')})`, ...ids) : []);
    for (const w of await pick('words', 'word_id', byType('word'))) out.push(reviewWord(w, await wordRows([lessonNum(w.lesson_id)])));
    for (const r of await pick('grammar_questions', 'question_id', byType('gram'))) out.push(reviewGram(r));
    for (const s of await pick('sentences', 'example_id', byType('sent'))) out.push(reviewSent(s, await sentenceRows([lessonNum(s.lesson_id)])));
    return shuffle(out);
  }
  const favs = new Set((await db.all('SELECT item_id FROM favorites WHERE user_id = ?', userId)).map((r) => r.item_id));
  const keep = (id) => !favOnly || favs.has(id);
  for (const num of lessons) {
    const words = await wordRows([num]);
    if (modes.includes('word')) words.filter((w) => keep(w.word_id)).forEach((w) => out.push(reviewWord(w, words)));
    if (modes.includes('ox')) words.filter((w) => keep(w.word_id)).forEach((w) => out.push({ t: 'ox', id: w.word_id, lesson: num, g: w.단어, m: w.뜻 }));
    if (modes.includes('gram')) shuffle((await grammarRows([num])).filter((r) => keep(r.question_id))).slice(0, REVIEW_GRAMMAR_PICK).forEach((r) => out.push(reviewGram(r)));
    if (modes.includes('sent')) {
      const sents = await sentenceRows([num]);
      sents.filter((s) => keep(s.example_id)).forEach((s) => out.push(reviewSent(s, sents)));
    }
  }
  return shuffle(out);
}

// 암기 설정 화면용: 과별 문항 수(전체·즐겨찾기), 오답 노트 목록
export async function reviewMeta(userId) {
  const db = await getDb();
  const favs = new Set((await db.all('SELECT item_id FROM favorites WHERE user_id = ?', userId)).map((r) => r.item_id));
  const counts = {};
  for (const l of (await allLessons()).filter((x) => x.ready)) {
    const [w, g, s] = await Promise.all([wordRows([l.id]), grammarRows([l.id]), sentenceRows([l.id])]);
    const fav = (rows, pk) => rows.filter((r) => favs.has(r[pk])).length;
    counts[l.id] = {
      word: w.length, gram: Math.min(REVIEW_GRAMMAR_PICK, g.length), sent: s.length,
      favWord: fav(w, 'word_id'), favGram: Math.min(REVIEW_GRAMMAR_PICK, fav(g, 'question_id')), favSent: fav(s, 'example_id'),
    };
  }
  const label = async (n) => {
    const one = async (sql) => (await db.get(sql, n.item_id))?.l;
    if (n.item_type === 'word') return one('SELECT 단어 AS l FROM words WHERE word_id = ?');
    if (n.item_type === 'gram') return one('SELECT COALESCE(target_form, prompt) AS l FROM grammar_questions WHERE question_id = ?');
    return one('SELECT 문장 AS l FROM sentences WHERE example_id = ?');
  };
  const rows = await db.all('SELECT * FROM wrong_notes WHERE user_id = ? ORDER BY (wrong_count - streak_correct) DESC, last_wrong_at DESC', userId);
  const labels = await Promise.all(rows.map(label));
  const notes = rows.map((n, i) => ({ id: n.item_id, type: n.item_type, label: labels[i] || n.item_id, wrong: n.wrong_count, streak: n.streak_correct }));
  return { counts, notes, favCount: favs.size };
}
