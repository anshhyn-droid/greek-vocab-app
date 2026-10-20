// 새 과 엑셀(제N과_헬라어_학습DB.xlsx)과 문법 표 md(LNN_grammar_tables.md)를 lNN.json으로 바꿉니다.
// 사용: npm i xlsx  →  node convert_xlsx.mjs 9 "제9과_헬라어_학습DB.xlsx" grammar_tables_md/L09_grammar_tables.md
import fs from "node:fs"; import XLSX from "xlsx";
const [, , no, xlsxPath, mdPath] = process.argv; const n = String(no).padStart(2, "0");
const nv = v => (v === undefined || v === null || v === "none" || v === "") ? null : String(v);
const wb = XLSX.readFile(xlsxPath); const sheet = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }).slice(1).filter(r => r[0]);
const q = r => ({ id: r[0], lesson: r[1], prompt: String(r[2]), target: nv(r[3]), options: [r[4], r[5], r[6], r[7]].map(String), answer: Number(r[8]) - 1, explanation: nv(r[9]), page: nv(r[10]), note: nv(r[11]) });
function parseMd(md) { const o = { title: "", source: null, sections: [] }; let sec = null, tbl = null;
  for (const raw of md.split("\n")) { const l = raw.trim(); if (!l) { tbl = null; continue; }
    if (l.startsWith("# ")) { o.title = l.slice(2); continue; } if (l.startsWith("출처")) { o.source = l.replace(/^출처:\s*/, ""); continue; }
    if (l.startsWith("## ")) { sec = { title: l.slice(3).replace(/^\d+\.\s*/, ""), blocks: [] }; o.sections.push(sec); tbl = null; continue; }
    if (!sec) { sec = { title: "", blocks: [] }; o.sections.push(sec); }
    if (l.startsWith("### ")) { sec.blocks.push({ type: "h", text: l.slice(4) }); tbl = null; continue; }
    if (l.startsWith("|")) { const c = l.replace(/^\||\|$/g, "").split("|").map(x => x.trim()); if (c.every(x => /^:?-{2,}:?$/.test(x))) continue; if (!tbl) { tbl = { type: "table", headers: c, rows: [] }; sec.blocks.push(tbl); } else tbl.rows.push(c); continue; }
    tbl = null; if (l.startsWith("※")) { sec.blocks.push({ type: "note", text: l.replace(/^※\s*/, "") }); continue; }
    if (/^[-*] /.test(l)) { const last = sec.blocks.at(-1); if (last && last.type === "list") last.items.push(l.slice(2)); else sec.blocks.push({ type: "list", items: [l.slice(2)] }); continue; }
    sec.blocks.push({ type: "p", text: l }); }
  return o; }
const lessonRow = sheet("Lesson").find(r => Number(r[1]) === Number(no));
const P = sheet("sentence_parsing").map(r => ({ id: r[0], sentence: nv(r[1]), word: nv(r[2]), pos: nv(r[4]), form: r[5], lemma: nv(r[6]), meaning: nv(r[7]), gender: nv(r[8]), number: nv(r[9]), case: nv(r[10]), tense: nv(r[11]), voice: nv(r[12]), mood: nv(r[13]), person: nv(r[14]), gloss: nv(r[15]), page: nv(r[16]) }));
const out = {
  lesson: { id: lessonRow[0], no: Number(lessonRow[1]), title: String(lessonRow[2]).replace(/\n/g, " / ") },
  concepts: mdPath ? parseMd(fs.readFileSync(mdPath, "utf8")) : { title: "", source: null, sections: [] },
  words: sheet("words").map(r => ({ id: r[0], lesson: r[1], greek: r[2], stem: nv(r[3]), pos: nv(r[4]), meaning: r[5], gender: nv(r[6]), declension: nv(r[7]), type: nv(r[8]), note: nv(r[9]) })),
  grammarLearning: sheet("grammar_learning").map(q), grammarQuestions: sheet("grammar_questions").map(q),
  sentences: sheet("sentences").map(r => ({ id: r[0], lesson: r[1], no: Number(r[2]), greek: r[3], translation: r[4], page: nv(r[5]), status: nv(r[6]), note: nv(r[7]), parsing: P.filter(p => p.sentence === r[0]) })),
  parsingExtra: P.filter(p => !p.sentence) };
fs.writeFileSync(`l${n}.json`, JSON.stringify(out, null, 1)); console.log(`l${n}.json 저장: 단어 ${out.words.length}, 문법 학습 ${out.grammarLearning.length}, 문법 테스트 ${out.grammarQuestions.length}, 문장 ${out.sentences.length}`);
