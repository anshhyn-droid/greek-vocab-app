// 테스트 탭 (design/Review.dc.html, steps/step08_test.md). 설명 없이 빠르게 외우는 곳
// 왼쪽 쪽 위 색인 탭: 테스트 / 오답 노트(개수) / 책갈피(개수). 설명은 왼쪽 쪽, 목록은 오른쪽 쪽
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlocksIcon, BookA, Bookmark, ClipboardCheck, Layers2, ListChecks, NotebookPen, Table2, X } from 'lucide-react';
import BookPages from '../../components/book/BookPages';
import ConceptSection from '../../components/ConceptSection';
import Dialog from '../../components/ui/Dialog';
import { api } from '../../lib/api';
import { useBookSize } from '../../lib/viewport';
import { useBookmarks } from '../../study/bookmarks';
import { KIND, labelOf, loadLibrary, shuffle, typeOf, type Library, type TItem, type TKind } from './pool';
import TestRun from './TestRun';
import s from './Test.module.css';

const LIMIT = 20;
const MODES: { k: TKind; desc: string; icon: typeof BookA }[] = [
  { k: 'word', desc: '뜻 고르기', icon: BookA },
  { k: 'flash', desc: '넘기며 외우기', icon: Layers2 },
  { k: 'gram', desc: '알맞은 답', icon: ListChecks },
  { k: 'sent', desc: '해석·파싱', icon: BlocksIcon },
];
const GROUPS = [
  { k: 'word', label: '단어', icon: BookA },
  { k: 'gram', label: '문법', icon: ListChecks },
  { k: 'sent', label: '문장', icon: BlocksIcon },
  { k: 'concept', label: '문법 개념', icon: Table2 },
];
interface Note { type: string; id: string; lesson: number; wrong: number }
type Seg = 'test' | 'note' | 'fav';

export default function TestHome() {
  const { narrow, BH } = useBookSize();
  const bm = useBookmarks();
  const [lib, setLib] = useState<Library | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [seg, setSeg] = useState<Seg>('test');
  const [sel, setSel] = useState<TKind[]>(['word']);
  const [units, setUnits] = useState<number[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [noteFirst, setNoteFirst] = useState(true);
  const [running, setRunning] = useState<{ items: TItem[]; kind: 'mix' | 'flash'; name: string; lessons: number[] } | null>(null);
  const [concept, setConcept] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const reloadNotes = () => api<Note[]>('/api/notes').then(setNotes).catch(() => {});
  useEffect(() => { loadLibrary().then(setLib).catch(() => {}); reloadNotes(); }, []);

  const noteKey = (t: string, id: string) => t + ':' + id;
  const inNote = useMemo(() => new Set(notes.map((n) => noteKey(n.type, n.id))), [notes]);
  const favSet = useMemo(() => new Set(bm.list.map((b) => noteKey(b.type, b.id))), [bm.list]);

  // 문항 구성: 고른 종류·과에서 (오답 먼저면) 오답 노트 문항을 앞에, 나머지는 무작위로 최대 20문항. 문법은 grammarQuestions에서
  const plan = useMemo(() => {
    if (!lib) return { items: [] as TItem[], nNote: 0 };
    const pool: TItem[] = [];
    for (const n of units) {
      const l = lib.lessons.get(n);
      if (!l) continue;
      if (sel.includes('word')) l.words.forEach((w) => pool.push({ t: 'word', id: w.id, lesson: n }));
      if (sel.includes('flash')) l.words.forEach((w) => pool.push({ t: 'flash', id: w.id, lesson: n }));
      if (sel.includes('gram')) l.grammarQuestions.forEach((g) => pool.push({ t: 'gram', id: g.id, lesson: n }));
      if (sel.includes('sent')) l.sentences.forEach((x) => pool.push({ t: 'sent', id: x.id, lesson: n }));
    }
    const ok = favOnly ? pool.filter((it) => favSet.has(noteKey(typeOf(it.t), it.id))) : pool;
    const noted = (it: TItem) => inNote.has(noteKey(typeOf(it.t), it.id));
    if (!noteFirst) return { items: shuffle(ok).slice(0, LIMIT), nNote: 0 };
    const a = shuffle(ok.filter(noted)).slice(0, LIMIT), b = shuffle(ok.filter((x) => !noted(x))).slice(0, LIMIT - a.length);
    return { items: [...a, ...b], nNote: a.length };
  }, [lib, units, sel, favOnly, noteFirst, favSet, inNote]);

  // 종류: 플래시 카드는 단독, 단어·문법·문장은 여러 개
  const toggleMode = (k: TKind) => setSel((cur) => (k === 'flash' ? (cur.includes('flash') ? [] : ['flash']) : (() => { const base = cur.filter((x) => x !== 'flash'); return base.includes(k) ? base.filter((x) => x !== k) : [...base, k]; })()));

  // 과 선택: 누른 과부터 끌어간 과까지 범위로 칠하기 (학습 가능한 과만)
  const gridRef = useRef<HTMLDivElement>(null);
  const unitDown = (e: React.PointerEvent) => {
    const t = (e.target as HTMLElement).closest('[data-n]');
    if (!t || !lib) return;
    const n = Number(t.getAttribute('data-n'));
    if (!lib.ready.includes(n)) return;
    const on = !units.includes(n), base = [...units];
    const paint = (m: number) => {
      const span = lib.ready.filter((x) => x >= Math.min(n, m) && x <= Math.max(n, m));
      setUnits((on ? [...new Set([...base, ...span])] : base.filter((x) => !span.includes(x))).sort((x, y) => x - y));
    };
    paint(n);
    const move = (ev: PointerEvent) => { const c = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-n]'); if (c) paint(Number(c.getAttribute('data-n'))); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const canStart = sel.length > 0 && units.length > 0 && plan.items.length > 0;
  const startLabel = !sel.length ? '종류를 고르세요' : !units.length ? '과를 고르세요' : !plan.items.length ? '고른 조건에 맞는 문항이 없습니다' : '테스트 시작';
  const start = () => {
    if (!units.length && sel.length) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    if (!canStart) return;
    setRunning({ items: plan.items, kind: sel.includes('flash') ? 'flash' : 'mix', name: sel.map((k) => KIND[k]).join(' · '), lessons: units });
  };
  const startNotes = () => {
    if (!lib || !notes.length) return;
    const items = shuffle(notes.filter((n) => lib.lessonOf(n.type, n.id) != null).map((n) => ({ t: n.type as TKind, id: n.id, lesson: n.lesson })));
    setRunning({ items, kind: 'mix', name: '오답 노트', lessons: [...new Set(items.map((i) => i.lesson))] });
  };

  if (running && lib)
    return <TestRun lib={lib} {...running} onExit={() => { setRunning(null); reloadNotes(); }} />;

  // ── 색인 탭 ──
  const favRows = lib ? bm.list.map((b) => ({ ...b, label: labelOf(lib, b.type, b.id) })).filter((b) => b.label) : [];
  const segs: { k: Seg; label: string; icon: typeof BookA; n?: number }[] = [
    { k: 'test', label: '테스트', icon: ClipboardCheck },
    { k: 'note', label: '오답 노트', icon: NotebookPen, n: notes.length },
    { k: 'fav', label: '책갈피', icon: Bookmark, n: favRows.length },
  ];
  const tabs = (
    <div className={s.tabs} role="tablist">
      {segs.map((x) => (
        <button key={x.k} role="tab" aria-selected={seg === x.k} onClick={() => { setSeg(x.k); if (x.k === 'note') reloadNotes(); }} className={s.tab} data-on={seg === x.k}>
          <x.icon size={13} strokeWidth={2.75} />
          <span>{x.label}</span>
          {!!x.n && <span className={s.tabN} data-kind={x.k}>{x.n}</span>}
        </button>
      ))}
    </div>
  );
  const head = (
    <div className={s.head}>
      <span className={s.h1}>테스트</span>
      <span className={s.desc}>설명 없이 문제만 빠르게 넘기며 외웁니다.</span>
    </div>
  );

  let left: React.ReactNode, right: React.ReactNode;
  if (seg === 'test') {
    left = (
      <div className={s.modes}>
        <span className={s.kick}>무엇을 풀까요</span>
        {MODES.map((m) => {
          const on = sel.includes(m.k);
          return (
            <button key={m.k} onClick={() => toggleMode(m.k)} className={s.mode} data-on={on} aria-pressed={on}>
              <span className={s.radio} data-on={on}>{on ? '✓' : ''}</span>
              <span className={s.modeL}>{KIND[m.k]}</span>
              <span className={s.modeD}>{m.desc}</span>
            </button>
          );
        })}
        <Switch on={favOnly} onClick={() => setFavOnly(!favOnly)} icon={<Bookmark size={16} strokeWidth={2.75} color="var(--accent)" />} label="책갈피만" n={bm.list.filter((b) => b.type !== 'concept').length} />
        <Switch on={noteFirst} onClick={() => setNoteFirst(!noteFirst)} icon={<NotebookPen size={16} strokeWidth={2.75} color="var(--wrong)" />} label="오답 먼저" n={notes.length} />
      </div>
    );
    right = (
      <div className={s.unitsCol}>
        <div className={s.kickRow}>
          <span className={s.kick} style={{ color: shake ? 'var(--wrong-ink)' : undefined }}>어느 과를 풀까요</span>
          {!!units.length && <button onClick={() => setUnits([])} className={s.clearU}>선택 해제</button>}
        </div>
        <div ref={gridRef} onPointerDown={unitDown} className={s.units} data-shake={shake}>
          {Array.from({ length: 26 }, (_, i) => i + 1).map((u) => {
            const ready = !!lib?.ready.includes(u), on = units.includes(u);
            return <div key={u} data-n={u} className={s.unit} data-on={on} data-ready={ready} title={ready ? `제${u}과` : `제${u}과는 준비 중`}>{u}</div>;
          })}
        </div>
        <span className={s.help}>누른 채로 끌면 처음 과부터 끝 과까지 한 번에 선택됩니다</span>
        <div className={s.sum}>
          <div className={s.sumRow}>
            <span className={s.sumN}>{plan.items.length}문항</span>
            <span className={s.sumSub}>{!sel.length || !units.length ? '종류와 과를 고르면 문항 수가 정해집니다' : plan.nNote ? `오답 노트 ${plan.nNote} + 새 문항 ${plan.items.length - plan.nNote}` : `최대 ${LIMIT}문항`}</span>
          </div>
          <button onClick={start} className={s.start} data-on={canStart}>{startLabel}</button>
        </div>
      </div>
    );
  } else {
    const isNote = seg === 'note';
    const rows = isNote
      ? notes.map((nt) => ({ type: nt.type, id: nt.id, lesson: nt.lesson, label: lib ? labelOf(lib, nt.type, nt.id) : nt.id, extra: `${nt.wrong}회 틀림` }))
      : favRows.map((b) => ({ type: b.type, id: b.id, lesson: lib?.lessonOf(b.type, b.id) ?? b.lesson, label: b.label, extra: '' }));
    left = (
      <div className={s.listIntro}>
        <span className={s.total}>{rows.length}개</span>
        <span className={s.desc}>{isNote ? '학습과 테스트에서 한 번에 못 맞힌 문항이 모입니다. 다른 회차에서 두 번 연속 한 번에 맞히면 빠집니다.' : '학습 중에 책갈피에 담은 단어, 문법, 문장, 문법 개념이 모입니다.'}</span>
        {isNote ? (
          <button onClick={startNotes} className={s.start} data-on={rows.length > 0}>오답만 다시 풀기</button>
        ) : (
          <button onClick={() => { if (favRows.length) { setSeg('test'); setFavOnly(true); } }} className={s.start} data-on={favRows.length > 0}>책갈피로 테스트</button>
        )}
      </div>
    );
    right = rows.length ? (
      <div className={`${s.groups} scroll-hidden`}>
        {GROUPS.filter((g) => rows.some((r) => r.type === g.k)).map((g) => (
          <div key={g.k} className={s.group}>
            <div className={s.gHead}><g.icon size={15} strokeWidth={2.75} /><span>{g.label}</span><b>{rows.filter((r) => r.type === g.k).length}</b></div>
            {rows.filter((r) => r.type === g.k).map((r) => (
              <div key={r.type + r.id} className={s.row}>
                <span className={s.rLesson}>제{r.lesson}과</span>
                <span className={`${s.rLabel} ${r.type === 'word' || r.type === 'sent' ? 'gk' : ''}`} data-type={r.type}>{r.label}</span>
                {r.extra && <span className={s.rExtra}>{r.extra}</span>}
                {r.type === 'concept' && <button onClick={() => setConcept(r.id)} className={s.rLink}>보기</button>}
                {!isNote && <button onClick={() => bm.toggle(r.type as 'word', r.id)} className={s.rRemove} title="책갈피에서 빼기"><X size={14} strokeWidth={2.75} /></button>}
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : (
      <div className={s.empty}>
        <b>{isNote ? '오답 노트가 비어 있습니다' : '책갈피가 비어 있습니다'}</b>
        <span>{isNote ? '틀린 문항이 생기면 종류별로 여기에 모입니다.' : '학습 화면에서 책갈피 끈을 내리면 여기에 모입니다.'}</span>
      </div>
    );
  }

  const conceptDlg = concept && lib && (() => {
    const n = Number(concept.slice(1, 3)), i = Number(concept.split('-')[1]) - 1;
    const sec = lib.lessons.get(n)?.concepts.sections[i];
    return sec ? (
      <Dialog onClose={() => setConcept(null)} maxWidth={720} style={{ padding: '22px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, font: '700 13px var(--f-body)', color: 'var(--accent-ink)' }}>제{n}과 문법 개념</span><button onClick={() => setConcept(null)} aria-label="닫기"><X size={20} strokeWidth={2.75} /></button></div>
        <ConceptSection section={{ ...sec, title: sec.title || `개념 표 ${i + 1}` }} />
      </Dialog>
    ) : null;
  })();

  if (narrow)
    return (
      <div className={s.phone}>
        {head}
        {tabs}
        {left}
        {right}
        {conceptDlg}
      </div>
    );
  return (
    <>
      <BookPages
        leftPad={BH < 600 ? "20px 36px 18px 26px" : "30px 40px 28px 30px"}
        rightPad={BH < 600 ? "22px 30px 18px 48px" : "34px 34px 28px 52px"}
        left={<div className={s.left} data-compact={BH < 600}>{head}{tabs}<div className={s.segBody}>{left}</div></div>}
        right={<div className={s.right} data-compact={BH < 600}>{right}</div>}
      />
      {conceptDlg}
    </>
  );
}

function Switch({ on, onClick, icon, label, n }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; n: number }) {
  return (
    <button onClick={onClick} className={s.switchRow} aria-pressed={on}>
      {icon}
      <span className={s.swL}>{label}</span>
      <span className={s.swN}>{n}</span>
      <span className={s.sw} data-on={on}><span /></span>
    </button>
  );
}
