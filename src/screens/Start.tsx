// 첫 화면: 닫힌 책 표지 → 눌러서 펼치기 → 첫 장의 ΛΟΓΟΣ와 "Google로 계속하기" (design/Start.dc.html)
// 로그인 상태면 학습 홈으로. 처음 가입이면 약관 동의 창
import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, X } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import { CONSENT_TYPES, useAuth } from '../lib/auth';
import { DOCS, type DocKind } from '../lib/docs';
import { LOGOUT_REASON } from '../lib/idle';
import { LS } from '../lib/storage';
import { supabaseConfigured } from '../lib/supabase';
import { useBookSize } from '../lib/viewport';
import styles from './Start.module.css';

const NOTICES: Record<string, string> = {
  idle: '하루 동안 사용하지 않아 로그아웃되었어요. 다시 로그인해 주세요.',
  withdrawn: '탈퇴가 완료되었습니다. 계정과 학습 기록이 모두 삭제되었습니다.',
};

export default function Start() {
  const { status, signIn, error } = useAuth();
  const navigate = useNavigate();
  const size = useBookSize();
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => {
    const r = LS.get(LOGOUT_REASON);
    LS.remove(LOGOUT_REASON);
    return r ? NOTICES[r] ?? null : null;
  });

  useEffect(() => {
    if (status === 'ready') navigate('/learn', { replace: true });
  }, [status, navigate]);
  // 동의 단계로 돌아왔으면 책을 펼쳐 둠
  const consent = status === 'needsConsent';
  const isOpen = open || consent;

  // 책을 누르면 펼치기/닫기. 버튼(data-nobook)이나 창이 떠 있을 때는 무시
  const toggle = (e: MouseEvent) => {
    if (consent || signing || (e.target as HTMLElement).closest('[data-nobook]')) return;
    setOpen((o) => !o);
  };
  const login = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!supabaseConfigured) return;
    setSigning(true);
    await signIn();
  };

  const firstPage = (
    <>
      <span className={styles.verse}>ἐν ἀρχῇ ἦν ὁ λόγος</span>
      <span className={styles.rule} />
      <span className={styles.title}>ΛΟΓΟΣ</span>
      {isOpen && !signing && !consent && (
        <button data-nobook="1" onClick={login} className={styles.google} disabled={!supabaseConfigured}>
          <GoogleMark />
          Google로 계속하기
        </button>
      )}
      {signing && <span className={styles.waiting}>Google 창으로 이동하는 중…</span>}
      {!supabaseConfigured && isOpen && <span className={styles.waiting}>Supabase 설정이 아직 없습니다 (.env)</span>}
      {error && <span className={styles.err}>로그인하지 못했습니다: {error}</span>}
    </>
  );

  return (
    <div className={styles.root} data-screen-label="시작">
      {notice && (
        <div role="status" className={styles.notice}>
          <Info size={16} strokeWidth={2.75} />
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="닫기"><X size={15} strokeWidth={2.75} /></button>
        </div>
      )}

      {size.narrow ? (
        <div className={styles.mLeather}>
          <div className={styles.mPaper}>
            <div className={styles.mGold} />
            <div className={styles.mPersp}>
              <div onClick={toggle} className={styles.mFirst}>
                <div className={styles.mGold} />
                <div className={styles.mFirstBody}>{firstPage}</div>
              </div>
            </div>
          </div>
          <div className={styles.mPersp}>
            <div onClick={toggle} className={styles.mCover} style={{ transform: `rotateY(${isOpen ? -150 : 0}deg)`, pointerEvents: isOpen ? 'none' : 'auto' }}>
              <div className={styles.mSpine1} />
              <div className={styles.mSpine2} />
              <div className={styles.mFrame1} />
              <div className={styles.mFrame2} />
              <div className={styles.mFrame3} />
              <div style={{ position: 'absolute', inset: 'var(--sat) 0 var(--sab) 0' }}><Studs inset={54} left={66} /></div>
              <div className={styles.mCoverTitle}><span>ΛΟΓΟΣ</span></div>
              <span className={styles.mHint}>눌러서 펼치기</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.stage} style={{ left: `calc(50vw - 30px - ${size.BW / 4}px)`, top: `calc(50vh - ${size.BH / 2}px)` }}>
          <div className={styles.floorShadow} />
          <div className={styles.book} style={{ width: size.BW / 2, height: size.BH, transform: `translateX(${isOpen ? size.BW / 4 : 0}px)` }}>
            <div className={styles.backBoard} />
            <div className={styles.edge} />
            <div className={styles.pageBlock} />
            <div onClick={toggle} className={styles.firstPage}>{firstPage}</div>
            <div onClick={toggle} className={styles.cover} style={{ transform: `rotateY(${isOpen ? -170 : 0}deg)` }}>
              <div className={styles.coverFront}>
                <span className={styles.hint}>눌러서 펼치기</span>
                <div className={styles.spine1} />
                <div className={styles.spine2} />
                <div className={styles.spineGold} />
                <div className={styles.frame1} />
                <div className={styles.frame2} />
                <div className={styles.frame3} />
                <Studs inset={48} left={80} />
                <div className={styles.coverTitle}><span>ΛΟΓΟΣ</span></div>
              </div>
              <div className={styles.coverBack}><div /></div>
            </div>
          </div>
        </div>
      )}

      {consent && <ConsentDialog />}
    </div>
  );
}

// 표지 금박 테두리 네 모서리의 점
function Studs({ inset, left }: { inset: number; left: number }) {
  const s = { position: 'absolute', width: 5, height: 5, borderRadius: 999, background: 'var(--gold)' } as const;
  return (
    <>
      <span style={{ ...s, top: inset, left }} />
      <span style={{ ...s, top: inset, right: 48 }} />
      <span style={{ ...s, bottom: inset, left }} />
      <span style={{ ...s, bottom: inset, right: 48 }} />
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// 약관 동의: 만 14세 이상·이용약관·개인정보 수집·이용 (모두 필수, "모두 동의")
const CONSENTS: { k: (typeof CONSENT_TYPES)[number]; label: string; doc?: DocKind; rows?: { k: string; v: string }[] }[] = [
  { k: 'age', label: '만 14세 이상입니다' },
  { k: 'terms', label: '이용약관 동의', doc: 'terms' },
  { k: 'privacy', label: '개인정보 수집·이용 동의', rows: [{ k: '항목', v: '이름, 이메일 주소, 학습 기록' }, { k: '목적', v: '계정 확인, 학습 기록 저장과 동기화' }, { k: '보유 기간', v: '탈퇴 시 바로 삭제' }] },
];

function ConsentDialog() {
  const { acceptConsent, signOut } = useAuth();
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const all = CONSENTS.every((c) => on[c.k]);
  const ok = async () => {
    if (!all || busy) return;
    setBusy(true);
    setErr(false);
    try {
      await acceptConsent();
    } catch {
      setErr(true);
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog onClose={() => !busy && signOut()}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className={styles.dTitle}>약관 동의</span>
          <span className={styles.dSub}>처음 가입할 때 한 번만 받습니다. 필수 항목에 모두 동의해야 가입됩니다.</span>
        </div>
        <button onClick={() => setOn(Object.fromEntries(CONSENTS.map((c) => [c.k, !all])))} className={styles.allRow} data-on={all}>
          <span className={styles.chk} data-on={all}><Check size={13} strokeWidth={2.75} /></span>
          <span style={{ font: '700 16px var(--f-body)' }}>모두 동의</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 4px' }}>
          {CONSENTS.map((c) => (
            <div key={c.k} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
                <button onClick={() => setOn({ ...on, [c.k]: !on[c.k] })} className={styles.cRow} aria-pressed={!!on[c.k]}>
                  <span className={styles.chk} data-on={!!on[c.k]} style={{ width: 20, height: 20 }}><Check size={12} strokeWidth={2.75} /></span>
                  <span className={styles.req}>[필수]</span>
                  <span className={styles.cLabel}>{c.label}</span>
                </button>
                {(c.doc || c.rows) && (
                  <button className={styles.more} onClick={() => (c.doc ? setDoc(c.doc) : setDetail(detail === c.k ? null : c.k))}>
                    {c.rows && detail === c.k ? '접기' : '보기'}
                  </button>
                )}
              </div>
              {c.rows && detail === c.k && (
                <div className={styles.rows}>
                  {c.rows.map((r) => (
                    <div key={r.k} style={{ display: 'flex', gap: 10 }}>
                      <span className={styles.rowK}>{r.k}</span>
                      <span className={styles.rowV}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {err && <span role="alert" style={{ font: '600 13px var(--f-body)', color: 'var(--wrong-ink)' }}>저장하지 못했습니다. 다시 시도해 주세요.</span>}
        <button onClick={ok} className={styles.okBtn} data-on={all && !busy} disabled={!all || busy}>{busy ? '가입하는 중…' : '동의하고 시작하기'}</button>
      </Dialog>
      {doc && <DocDialog kind={doc} onClose={() => setDoc(null)} />}
    </>
  );
}

export function DocDialog({ kind, onClose }: { kind: DocKind; onClose: () => void }) {
  const d = DOCS[kind];
  return (
    <Dialog onClose={onClose} maxWidth={520} style={{ zIndex: 55, gap: 14, padding: '24px 24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={styles.dTitle} style={{ flex: 1, fontSize: 21 }}>{d.title}</span>
        <button onClick={onClose} aria-label="닫기" style={{ color: 'var(--muted)' }}><X size={22} strokeWidth={2.75} /></button>
      </div>
      <span className={styles.temp}>임시 문안입니다. 실제 문서가 정해지면 교체합니다.</span>
      {d.rows.map((r) => (
        <div key={r.h} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ font: '700 14px var(--f-body)' }}>{r.h}</span>
          <span style={{ font: '500 14px/1.65 var(--f-body)', color: 'var(--muted)', wordBreak: 'keep-all' }}>{r.b}</span>
        </div>
      ))}
    </Dialog>
  );
}
