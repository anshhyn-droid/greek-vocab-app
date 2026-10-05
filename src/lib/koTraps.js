// 문장 학습 해석 블록의 함정 낱말 자동 생성 (문장학습_명세.md 3번)
// 인칭·격 함정 최대 2개 + 동사 함정 후보 최대 5개(시제·법·태·문형)

// ── 한글 음절 ────────────────────────────────────────────
const BASE = 0xac00;
const J = { A: 0, O: 8, U: 13, WO: 14, EU: 18, I: 20, YEO: 6, WA: 9, EO: 4 };
const JONG = { NONE: 0, N: 4, D: 7, L: 8, SS: 20 };

function split(ch) {
  const c = ch.charCodeAt(0) - BASE;
  if (c < 0 || c > 11171) return null;
  return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 };
}
const join = ({ cho, jung, jong }) => String.fromCharCode(BASE + cho * 588 + jung * 28 + jong);
const last = (w) => split(w.at(-1));
const withLast = (w, patch) => w.slice(0, -1) + join({ ...last(w), ...patch });
export const hasBatchim = (w) => !!(last(w) && last(w).jong);

// ── 동사 활용 ────────────────────────────────────────────
// ㄷ 불규칙 (듣다 → 들어)
const D_IRREGULAR = new Set(['듣', '묻', '걷', '깨닫', '싣']);
// 수동형 어간. 없으면 "-하다 → -되다", 그 밖은 "-어지다"
const PASSIVE = { 말하: '말해지', 듣: '들리', 풀: '풀리', 가르치: '가르침받', 믿: '믿어지', 보: '보이', 잡: '잡히', 열: '열리', 쓰: '쓰이' };
// 보조 용언: 시제·문형만 바꿈
const AUX = new Set(['있', '않', '없']);

// 아/어 형태 (풀 → 풀어, 하 → 해, 치 → 쳐)
function infinitive(stem) {
  if (stem.endsWith('하')) return stem.slice(0, -1) + '해';
  let s = stem;
  if (D_IRREGULAR.has(s)) s = withLast(s, { jong: JONG.L });
  const l = last(s);
  const bright = l.jung === J.A || l.jung === J.O;
  if (l.jong) return s + (bright ? '아' : '어');
  if (l.jung === J.A || l.jung === J.EO || l.jung === J.YEO || l.jung === 1 || l.jung === 5) return s;
  if (l.jung === J.O) return withLast(s, { jung: J.WA });
  if (l.jung === J.U) return withLast(s, { jung: J.WO });
  if (l.jung === J.I) return withLast(s, { jung: J.YEO });
  if (l.jung === J.EU) return withLast(s, { jung: J.EO });
  return s + '어';
}
const pastStem = (stem) => withLast(infinitive(stem), { jong: JONG.SS }); // 했, 쳤, 풀었
function present(stem) {
  if (stem === '있' || stem === '없') return stem + '다';
  const l = last(stem);
  if (!l.jong) return withLast(stem, { jong: JONG.N }) + '다'; // 한다, 친다
  if (l.jong === JONG.L) return withLast(stem, { jong: JONG.N }) + '다'; // 푼다
  return stem + '는다'; // 듣는다
}
const dropL = (stem) => (last(stem).jong === JONG.L ? withLast(stem, { jong: 0 }) : stem);
const presentQ = (stem) => dropL(stem) + '는가'; // 가르치는가, 푸는가
const imperative = (stem) => (hasBatchim(stem) ? infinitive(stem) + '라' : stem + '라'); // 하라, 풀어라
function passive(stem) {
  if (PASSIVE[stem]) return PASSIVE[stem];
  if (stem.endsWith('하') && stem.length > 1) return stem.slice(0, -1) + '되';
  return infinitive(stem) + '지';
}

// 문장 속 동사 낱말을 알아봄: 어떤 어간의 어떤 형태인지
const FORMS = {
  decl: present,
  q: presentQ,
  neg: (s) => s + '지',
  conj: (s) => s + '고',
};
function parseVerb(token, stems) {
  for (const stem of stems) for (const [form, f] of Object.entries(FORMS)) if (f(stem) === token) return { stem, form };
  return null;
}

// 형태별 함정 후보
function verbTraps({ stem, form }) {
  if (AUX.has(stem)) {
    if (form === 'decl') return [pastStem(stem) + '다', stem + '겠다', presentQ(stem)];
    if (form === 'q') return [pastStem(stem) + '는가', present(stem)];
    return [];
  }
  const p = passive(stem);
  switch (form) {
    case 'decl': return [pastStem(stem) + '다', stem + '겠다', imperative(stem), present(p), presentQ(stem)];
    case 'q': return [pastStem(stem) + '는가', imperative(stem), presentQ(p), present(stem), stem + '겠는가'];
    case 'neg': return [p + '지', pastStem(stem) + '지'];
    case 'conj': return [pastStem(stem) + '다', present(p), imperative(stem), stem + '겠다'];
    default: return [];
  }
}

// ── 인칭·격 ──────────────────────────────────────────────
const PRONOUNS = ['너희', '우리', '그들', '나', '너', '그'];
const PRONOUN_SWAP = { 나: '그들', 너: '너희', 우리: '나', 너희: '그들', 그: '그들', 그들: '우리' };
// 조사 묶음: [받침 있을 때, 없을 때]
const CASES = { topic: ['은', '는'], subj: ['이', '가'], obj: ['을', '를'], gen: ['의', '의'] };
const CASE_SWAP = { topic: 'obj', subj: 'obj', obj: 'subj', gen: 'obj' };
const particle = (noun, kind) => CASES[kind][hasBatchim(noun) ? 0 : 1];

function parseNoun(token) {
  for (const [kind, [withB, noB]] of Object.entries(CASES)) {
    for (const p of new Set([withB, noB])) {
      if (token.length < 2 || !token.endsWith(p)) continue;
      const noun = token.slice(0, -p.length);
      if (kind !== 'gen' && particle(noun, kind) !== p) continue; // 받침과 조사가 맞아야 조사로 봄
      return { noun, kind };
    }
  }
  return null;
}

function nounTrap(token) {
  const n = parseNoun(token);
  if (!n) return null;
  if (PRONOUNS.includes(n.noun)) {
    // 인칭: 대명사를 다른 인칭으로 (나는 → 그들은). 주격 '가/이'는 주제 '은/는'으로
    const to = PRONOUN_SWAP[n.noun];
    const kind = n.kind === 'subj' ? 'topic' : n.kind;
    return { type: 'person', t: to + particle(to, kind) };
  }
  // 격: 조사를 바꿈 (여주인을 → 여주인이)
  return { type: 'case', t: n.noun + particle(n.noun, CASE_SWAP[n.kind]) };
}

// ── 공개 함수 ────────────────────────────────────────────
export const stripPunct = (s) => s.replace(/[.,?!;:"'“”‘’…·()[\]]/g, '');
export const koTokens = (translation) => String(translation || '').split(/\s+/).map(stripPunct).filter(Boolean);

// 뜻 목록("풀다; 파괴하다", "듣다")에서 어간 목록을 만듦. 긴 어간부터
export function verbStems(meanings) {
  const set = new Set(['있', '않', '없']);
  for (const m of meanings) {
    for (const part of String(m || '').split(/[;,/]/)) {
      const w = part.trim();
      if (w.length > 1 && w.endsWith('다')) set.add(w.slice(0, -1));
    }
  }
  return [...set].sort((a, b) => b.length - a.length);
}

/**
 * 정답 낱말에서 함정 후보를 만듦
 * @returns {{ nounTraps: string[], verbCandidates: string[] }}
 *   nounTraps: 인칭·격 함정 (최대 2개, 인칭 먼저)
 *   verbCandidates: 동사 함정 후보 (최대 5개). 출제할 때 이 중 무작위 3개를 씀
 */
export function buildTraps(tokens, stems) {
  const correct = new Set(tokens);
  const nouns = [];
  const mainLists = [];
  const auxLists = [];
  for (const t of tokens) {
    const v = parseVerb(t, stems);
    if (v) (AUX.has(v.stem) ? auxLists : mainLists).push(verbTraps(v));
    else {
      const n = nounTrap(t);
      if (n) nouns.push(n);
    }
  }
  const uniq = (arr) => [...new Set(arr)].filter((x) => !correct.has(x));
  const nounTraps = uniq([...nouns.filter((n) => n.type === 'person'), ...nouns.filter((n) => n.type === 'case')].map((n) => n.t)).slice(0, 2);
  // 본동사 후보를 번갈아 모은 뒤 보조 용언 후보를 붙임
  const roundRobin = (lists) => {
    const out = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
    return out;
  };
  const verbCandidates = uniq([...roundRobin(mainLists), ...roundRobin(auxLists)]).filter((x) => !nounTraps.includes(x)).slice(0, 5);
  return { nounTraps, verbCandidates };
}
