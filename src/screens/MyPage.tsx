// 마이페이지 (design/Start.dc.html "마이페이지", steps/step09_mypage.md)
// 왼쪽 쪽: 학습 기록(누적 경험치·학습한 날·최근 7일 경험치 막대·과별 진도) / 오른쪽 쪽: 설정(계정·글자 크기·개인정보·초기화·탈퇴)
import { useEffect, useState } from 'react';
import { CalendarCheck, Check, ChevronRight, FileText, LogOut, RotateCcw, ShieldCheck, Sparkles, UserX } from 'lucide-react';
import BookPages from '../components/book/BookPages';
import Dialog from '../components/ui/Dialog';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { shortTitle } from '../lib/lessons';
import { setFontSize, useBookSize } from '../lib/viewport';
import { loadLessonIndex } from '../data/content';
import type { LessonIndex } from '../data/types';
import { DocDialog } from './Start';
import type { DocKind } from '../lib/docs';
import st from '../study/study.module.css';
import s from './MyPage.module.css';

interface Summary {
  name: string;
  email: string;
  fontSize: 'm' | 'l' | 'xl';
  xp: number;
  studyDays: number;
  week: { date: string; xp: number }[];
  progress: { lesson: number; type: string; status: string }[];
}
const DAY = ['일', '월', '화', '수', '목', '금', '토'];
const KINDS = [['word', '단어'], ['gram', '문법'], ['sent', '문장']] as const;

export default function MyPage() {
  const { narrow } = useBookSize();
  const { signOut } = useAuth();
  const [d, setD] = useState<Summary | null>(null);
  const [idx, setIdx] = useState<LessonIndex | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'reauth' | 'fail' | 'ok'; text: string } | null>(null);
  const [doc, setDoc] = useState<DocKind | null>(null);
  const [wd, setWd] = useState(false);

  const load = () => api<Summary>('/api/me/summary').then(setD).catch(() => {});
  useEffect(() => { load(); loadLessonIndex().then(setIdx).catch(() => {}); }, []);

  const fail = (e: unknown) => setNotice(e instanceof ApiError && e.code === 'reauth'
    ? { kind: 'reauth', text: '보안을 위해 다시 로그인한 뒤 진행해 주세요. 로그인 후 같은 버튼을 다시 누르면 됩니다.' }
    : { kind: 'fail', text: '처리하지 못했습니다. 다시 시도해 주세요.' });

  // 두 번 눌러야 실행
  const reset = async () => {
    if (!confirmReset) return setConfirmReset(true);
    setConfirmReset(false);
    try {
      await api('/api/me/reset', { method: 'POST' });
      setNotice({ kind: 'ok', text: '학습 기록을 초기화했습니다. 계정과 설정은 그대로입니다.' });
      load();
    } catch (e) { fail(e); }
  };
  const font = (v: Summary['fontSize']) => {
    if (!d) return;
    setD({ ...d, fontSize: v });
    setFontSize(v);
    api('/api/settings', { method: 'PATCH', body: { fontSize: v } }).catch(() => {});
  };

  if (!d) return <BookPages left={null} right={null} />;
  const max = Math.max(1, ...d.week.map((w) => w.xp));
  const done = (n: number, k: string) => d.progress.some((p) => p.lesson === n && p.type === k && p.status === 'done');
  const going = (n: number, k: string) => d.progress.some((p) => p.lesson === n && p.type === k && p.status === 'in_progress');

  const record = (
    <div className={s.col}>
      <div className={s.head}><span className={s.h1}>학습 기록</span><span className={s.sub}>경험치와 과별 진도</span></div>
      <div className={s.stats}>
        <div className={s.stat}><Sparkles size={18} strokeWidth={2.75} color="var(--accent)" /><b>{d.xp.toLocaleString()}</b><span>누적 경험치</span></div>
        <div className={s.stat}><CalendarCheck size={18} strokeWidth={2.75} color="var(--sage)" /><b>{d.studyDays}일</b><span>학습한 날</span></div>
      </div>
      <div className={s.card}>
        <div className={s.cardHead}><span>최근 7일 경험치</span><b>합계 {d.week.reduce((a, w) => a + w.xp, 0).toLocaleString()} XP</b></div>
        <div className={s.bars} role="img" aria-label={'최근 7일 경험치: ' + d.week.map((w) => w.xp).join(', ')}>
          {d.week.map((w, i) => (
            <div key={w.date} className={s.barCol}>
              <span className={s.barV} data-today={i === 6}>{w.xp || '·'}</span>
              <div className={s.barTrack}><div className={s.bar} data-today={i === 6} style={{ height: Math.round((w.xp / max) * 100) + '%' }} /></div>
              <span className={s.barL} data-today={i === 6}>{i === 6 ? '오늘' : DAY[new Date(w.date + 'T00:00:00').getDay()]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={s.card}>
        <div className={s.cardHead}><span>과별 진도</span><b>{idx ? idx.ready.filter((n) => KINDS.every(([k]) => done(n, k))).length : 0} / {idx?.ready.length ?? 0} 완료</b></div>
        {idx?.ready.map((n) => (
          <div key={n} className={s.prow}>
            <span className={s.pn}>{n}과</span>
            <span className={s.pt}>{shortTitle(idx.lessons.find((l) => l.no === n)?.title || '')}</span>
            <span className={s.pk}>
              {KINDS.map(([k, label]) => (
                <span key={k} className={s.chip} data-state={done(n, k) ? 'done' : going(n, k) ? 'going' : ''} title={label}>{done(n, k) ? <Check size={11} strokeWidth={3} /> : null}{label}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const settings = (
    <div className={s.col}>
      <div className={s.head}><span className={s.h1}>마이페이지</span><span className={s.sub}>계정, 학습 설정, 개인정보</span></div>
      <div className={s.account}>
        <span className={s.avatar}>{[...(d.name || '?')][0]}</span>
        <div className={s.accText}><b>{d.name}</b><span>{d.email}</span></div>
        <button onClick={() => signOut('manual')} className={s.logout}><LogOut size={14} strokeWidth={2.75} />로그아웃</button>
      </div>
      <div className={s.card}>
        <span className={s.label}>글자 크기</span>
        <div className={s.seg}>
          {(['m', 'l', 'xl'] as const).map((v, i) => (
            <button key={v} onClick={() => font(v)} className={s.segBtn} data-on={d.fontSize === v} style={{ fontSize: [13, 15, 17][i] }} aria-pressed={d.fontSize === v}>
              가<span>{['보통', '크게', '아주 크게'][i]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.card} style={{ padding: '6px 8px' }}>
        <span className={s.label} style={{ padding: '10px 12px 2px' }}>개인정보</span>
        <button onClick={() => setDoc('policy')} className={s.link}><ShieldCheck size={17} strokeWidth={2.75} /><span>개인정보 처리방침</span><ChevronRight size={16} strokeWidth={2.75} /></button>
        <button onClick={() => setDoc('terms')} className={s.link}><FileText size={17} strokeWidth={2.75} /><span>이용약관</span><ChevronRight size={16} strokeWidth={2.75} /></button>
      </div>
      <button onClick={reset} className={s.reset} data-confirm={confirmReset}>
        <RotateCcw size={16} strokeWidth={2.75} />
        {confirmReset ? '한 번 더 누르면 모든 학습 기록이 지워집니다' : '학습 기록 초기화'}
      </button>
      {notice && (
        <div className={s.notice} data-kind={notice.kind} role="status">
          <span>{notice.text}</span>
          {notice.kind === 'reauth' && <button onClick={() => { window.location.href = '/api/auth/google'; }} className={st.primary} style={{ padding: '8px 14px', fontSize: 13 }}>다시 로그인</button>}
        </div>
      )}
      <button onClick={() => setWd(true)} className={s.withdraw}><UserX size={14} strokeWidth={2.75} />회원 탈퇴</button>
    </div>
  );

  return (
    <>
      {narrow ? (
        <div className={s.phone}>{settings}{record}</div>
      ) : (
        <BookPages leftPad="34px 56px 30px 36px" rightPad="34px 40px 30px 60px" left={record} right={settings} />
      )}
      {doc && <DocDialog kind={doc} onClose={() => setDoc(null)} />}
      {wd && <WithdrawDialog onClose={() => setWd(false)} onDone={() => signOut('withdrawn')} onError={(e) => { setWd(false); fail(e); }} />}
    </>
  );
}

// 회원 탈퇴 확인: 지워지는 것 · 되돌릴 수 없음 · 체크해야 탈퇴하기가 켜짐
function WithdrawDialog({ onClose, onDone, onError }: { onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await api('/api/me/withdraw', { method: 'POST', body: { confirm: true } });
      onDone();
    } catch (e) {
      setBusy(false);
      onError(e);
    }
  };
  return (
    <Dialog onClose={busy ? undefined : onClose} maxWidth={400}>
      <span className={st.dTitle}>정말 탈퇴할까요?</span>
      <div className={st.dBody}>
        탈퇴하면 아래 정보가 바로 지워집니다.
        <ul className={s.wdList}><li>학습 기록과 경험치</li><li>오답 노트와 책갈피</li><li>설정</li></ul>
        지운 정보는 <b className={st.red}>되돌릴 수 없습니다.</b> 같은 계정으로 다시 가입하면 처음부터 시작합니다.
      </div>
      <button onClick={() => setOk(!ok)} aria-pressed={ok} className={s.wdChk}>
        <span data-on={ok}>{ok && <Check size={13} strokeWidth={3} />}</span>안내를 확인했고 탈퇴합니다
      </button>
      <div className={st.dBtns}>
        <button autoFocus onClick={onClose} disabled={busy} className={st.primary} style={{ flex: 1.2 }}>취소</button>
        <button onClick={go} disabled={!ok || busy} className={s.wdBtn} data-on={ok && !busy} style={{ flex: 1 }}>{busy ? '탈퇴하는 중…' : '탈퇴하기'}</button>
      </div>
    </Dialog>
  );
}
