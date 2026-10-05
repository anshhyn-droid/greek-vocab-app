'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarCheck, Check, ChevronRight, Flame, LogOut, Repeat, RotateCcw, Sparkles } from 'lucide-react';
import { Ic } from '@/components/ui';
import { useWidth } from '@/components/hooks';
import { api } from '@/lib/api';
import { fmtDuration } from '@/lib/time';
import { MODE_LABEL, STUDY_LESSON } from '@/lib/lesson';

const APP_NAME = 'Ἑλληνική'; // 앱 이름 자리 — 이름이 정해지면 교체
const GREEK_LETTERS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
const SKELETON_W = ['62%', '48%', '70%', '55%', '66%', '44%', '58%'];
const GK_SCALE = { m: 1, l: 1.2, xl: 1.4 };
const LOGIN_ERRORS = {
  config: 'Google 로그인 설정이 아직 없습니다 (.env.local)',
  login: '로그인하지 못했습니다. 다시 시도해 주세요',
};
const lessonHref = (n) => (n === STUDY_LESSON ? '/' : null); // 지금 과 메뉴가 있는 과

const card = { borderRadius: 26, background: 'var(--card)', border: '1.5px solid var(--line)' };
const label = { font: "800 10.5px 'Noto Sans KR',sans-serif", letterSpacing: '.08em', color: 'var(--muted)' };

export default function StartApp({ initial, error }) {
  const router = useRouter();
  const [rootRef, w] = useWidth();
  const narrow = w < 700;
  const [dash, setDash] = useState(initial);
  const [screen, setScreen] = useState(initial ? 'list' : 'welcome');
  const [toast, setToast] = useState(error ? LOGIN_ERRORS[error] || LOGIN_ERRORS.login : null);
  const [signing, setSigning] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 3200 : 1600);
    return () => clearTimeout(toastTimer.current);
  }, [toast, error]);

  const refresh = () => api('/api/me').then(setDash).catch(() => {});
  const open = (n) => {
    const l = dash.lessons.find((x) => x.id === n);
    const href = l?.ready && lessonHref(n);
    if (href) router.push(href);
    else setToast(`제${n}과는 준비 중입니다`);
  };

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
      {screen === 'welcome' && (
        <Welcome
          narrow={narrow}
          signing={signing}
          onLogin={() => {
            setSigning(true);
            // Google 기본 로그인 창으로 가는 API 경로라 전체 이동
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = '/api/auth/google';
          }}
        />
      )}
      {screen === 'list' && dash && (
        <LessonList dash={dash} narrow={narrow} onOpen={open} onMe={() => { refresh(); setScreen('me'); }} />
      )}
      {screen === 'me' && dash && (
        <MyPage
          dash={dash}
          setDash={setDash}
          narrow={narrow}
          onBack={() => setScreen('list')}
          onLogout={async () => {
            await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
            setDash(null);
            setScreen('welcome');
            router.refresh();
          }}
        />
      )}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 40, padding: '12px 20px', borderRadius: 999, background: 'var(--color-text)', color: '#fffaf1', font: "700 13px 'Noto Sans KR',sans-serif", animation: 'pop .2s ease-out', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── 시작 화면 ─────────────────────────────────
function Welcome({ narrow, onLogin, signing }) {
  const rise = (delay, dur = 0.6) => ({ animation: `rise ${dur}s ${delay}s cubic-bezier(.2,.8,.2,1) both` });
  const hero = { fontFamily: 'var(--f-serif-kr)', fontWeight: 900, fontSize: narrow ? 42 : 76, lineHeight: 1.1, letterSpacing: '-.035em', wordBreak: 'keep-all' };
  return (
    <div data-screen-label="시작" style={{ minHeight: '100vh', background: 'radial-gradient(120% 90% at 85% 15%, var(--color-accent-100) 0%, var(--color-bg) 55%)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ minHeight: '100vh', maxWidth: 1080, margin: '0 auto', padding: narrow ? '36px 24px 44px' : '56px 56px', display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', gap: narrow ? 36 : 64 }}>
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: narrow ? 22 : 32, order: narrow ? 2 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...rise(0) }}>
            <span title="앱 이름 자리 — 이름이 정해지면 교체" style={{ fontFamily: 'var(--f-serif)', fontStyle: 'italic', fontSize: 16, letterSpacing: '.04em', color: 'var(--color-accent-700)' }}>{APP_NAME}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ ...hero, color: 'var(--color-text)', ...rise(0.08) }}>고전어 학습을</span>
            <span style={{ ...hero, color: 'var(--color-accent-700)', ...rise(0.18) }}>가장 효율적으로.</span>
          </div>
          <div style={{ display: 'flex', ...rise(0.3) }}>
            <button onClick={onLogin} disabled={signing} className="press" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '9px 26px 9px 9px', borderRadius: 999, background: 'var(--color-text)', boxShadow: '0 14px 30px -16px rgba(32,30,29,.6)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 17px 'Figtree',sans-serif", color: '#4285f4' }}>
                {signing ? <span style={{ width: 18, height: 18, borderRadius: 999, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', animation: 'spin .8s linear infinite' }} /> : 'G'}
              </span>
              <span style={{ font: "800 15px 'Noto Sans KR',sans-serif", color: '#fffaf1' }}>Google로 시작하기</span>
            </button>
          </div>
          <Link href="/privacy" style={{ font: "500 12.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)', textDecoration: 'underline', alignSelf: 'flex-start', marginTop: narrow ? -8 : -14, ...rise(0.36) }}>
            개인정보처리방침
          </Link>
        </div>

        {/* 아치 안 요한복음 1:1 (장식) */}
        <div style={{ flex: 'none', width: narrow ? 200 : 340, height: narrow ? 270 : 470, order: narrow ? 1 : 2, borderRadius: '999px 999px 34px 34px', background: 'var(--color-accent-700)', boxShadow: '0 30px 60px -30px rgba(120,52,20,.6)', position: 'relative', ...rise(0.1, 0.8) }}>
          <div style={{ position: 'absolute', inset: narrow ? 10 : 16, borderRadius: '999px 999px 24px 24px', border: '1.5px solid rgba(255,250,241,.32)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: narrow ? 10 : 16, padding: narrow ? '40px 22px 20px' : '70px 38px 34px', textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--f-serif)', fontWeight: 700, fontSize: narrow ? 40 : 68, lineHeight: 1, color: '#fffaf1' }}>Ἐν</span>
            <span style={{ fontFamily: 'var(--f-serif)', fontStyle: 'italic', fontSize: narrow ? 13.5 : 19, lineHeight: 1.55, color: '#fffaf1', textWrap: 'balance' }}>ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν</span>
            <span style={{ width: 26, height: 1.5, borderRadius: 999, background: 'rgba(255,250,241,.45)' }} />
            <span style={{ font: "700 10.5px 'Noto Sans KR',sans-serif", letterSpacing: '.18em', color: 'var(--color-accent-200)' }}>요한복음 1:1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ profile, size, fontSize }) {
  const base = { width: size, height: size, flex: 'none', borderRadius: 999, background: 'var(--sage)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${fontSize}px 'Noto Sans KR',sans-serif`, overflow: 'hidden' };
  // 사진이 없으면 이름 첫 글자
  return (
    <span style={base}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Google 프로필 사진(외부 주소, 작은 크기) */}
      {profile.avatar ? <img src={profile.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (profile.name || '?').slice(0, 1)}
    </span>
  );
}

function GoalCard({ goal, style }) {
  return (
    <div style={{ padding: '20px 22px', ...style, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ flex: 1, font: "800 13px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>오늘의 목표</span>
        <span style={{ font: "800 12px 'Figtree',sans-serif", color: 'var(--accent-ink)', whiteSpace: 'nowrap' }}>
          {goal.pct}% · {goal.done} / {goal.goal}문항
        </span>
      </div>
      {goal.rows.map((g) => {
        const full = g.done >= g.goal && g.goal > 0;
        return (
          <div key={g.k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 34, flex: 'none', font: "700 12.5px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>{g.label}</span>
            <div style={{ flex: 1, height: 9, borderRadius: 999, background: 'var(--color-neutral-200)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.round((g.done / Math.max(1, g.goal)) * 100) + '%', borderRadius: 999, background: full ? 'var(--sage)' : 'var(--color-accent)', transition: 'width .4s' }} />
            </div>
            <span style={{ width: 52, flex: 'none', textAlign: 'right', font: "800 12px 'Figtree',sans-serif", color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {g.done} / {g.goal}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 목차 ─────────────────────────────────────
function LessonList({ dash, narrow, onOpen, onMe }) {
  const { lessons, progress, steps, continueLesson: cur, goal, profile } = dash;
  const curLesson = lessons.find((l) => l.id === cur) || lessons[0];
  const doneOf = (n) => progress[n] || [];
  return (
    <div data-screen-label="과 선택" style={{ maxWidth: 1080, margin: '0 auto', padding: narrow ? '24px 16px 40px' : '44px 28px 64px', display: 'flex', flexDirection: 'column', gap: 28, animation: 'pop .3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span title="앱 이름 자리 — 이름이 정해지면 교체" style={{ fontFamily: 'var(--f-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: narrow ? 34 : 46, letterSpacing: '-.01em', lineHeight: 1.1, color: 'var(--ink)' }}>{APP_NAME}</span>
        </div>
        <Link href="/review" className="press" style={{ flex: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, background: 'var(--card)', border: '1.5px solid var(--line)', font: "700 13px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>
          <Ic icon={Repeat} size={15} color="var(--accent)" />암기
        </Link>
        <button onClick={onMe} className="press" style={{ flex: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '5px 12px 5px 5px', borderRadius: 999, background: 'var(--card)', border: '1.5px solid var(--line)' }}>
          <Avatar profile={profile} size={30} fontSize={13} />
          <span style={{ font: "700 13px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>마이페이지</span>
          <Ic icon={ChevronRight} size={14} color="var(--muted)" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'stretch' }}>
        {/* 이어서 학습하기: 가장 최근 학습한 과 */}
        <button onClick={() => onOpen(curLesson.id)} className="press-card" style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: narrow ? 16 : 24, padding: narrow ? '20px 18px' : '26px 30px', borderRadius: 30, background: 'radial-gradient(120% 140% at 90% 0%, var(--color-accent-100) 0%, #fffaf1 60%)', border: '1.5px solid var(--bd-cur)', boxShadow: '0 18px 40px -28px rgba(120,52,20,.45)', position: 'relative', overflow: 'hidden', textAlign: 'left' }}>
          <span style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--f-serif)', fontWeight: 700, fontSize: 150, lineHeight: 1, color: 'transparent', WebkitTextStroke: '1.5px var(--color-accent-200)', pointerEvents: 'none' }}>
            {GREEK_LETTERS[(curLesson.id - 1) % GREEK_LETTERS.length]}
          </span>
          <span style={{ fontFamily: 'var(--f-serif)', fontWeight: 700, fontSize: narrow ? 40 : 56, lineHeight: 1, color: 'var(--color-accent-700)', flex: 'none', position: 'relative' }}>{String(curLesson.id).padStart(2, '0')}</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
            <span style={{ font: "700 11px 'Noto Sans KR',sans-serif", letterSpacing: '.12em', color: 'var(--accent-ink)' }}>이어서 학습하기</span>
            <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 700, fontSize: narrow ? 20 : 26, lineHeight: 1.25, wordBreak: 'keep-all', color: 'var(--ink)' }}>
              제{curLesson.id}과{curLesson.title ? ' · ' + curLesson.title : ''}
            </span>
            <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
              {steps.map((st) => <span key={st} style={{ width: 26, height: 5, borderRadius: 999, background: doneOf(curLesson.id).includes(st) ? 'var(--sage)' : 'var(--color-neutral-300)' }} />)}
            </div>
          </div>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 999, background: 'var(--color-text)', color: '#fffaf1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Ic icon={ArrowRight} size={18} />
          </span>
        </button>
        <GoalCard goal={goal} style={{ ...card, borderRadius: 30, gap: 12 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', gridTemplateRows: narrow ? 'none' : `repeat(${Math.ceil(lessons.length / 2)},auto)`, gridAutoFlow: narrow ? 'row' : 'column', columnGap: 28, rowGap: 8 }}>
        {lessons.map((l, i) => {
          const done = doneOf(l.id);
          const all = l.ready && steps.every((st) => done.includes(st));
          return (
            <button key={l.id} onClick={() => onOpen(l.id)} className="press-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 16px 13px 18px', borderRadius: 20, textAlign: 'left', background: all ? 'var(--tile-done)' : l.ready ? 'var(--card)' : 'var(--tile)', border: '1.5px solid ' + (all ? 'var(--bd-done)' : l.ready ? 'var(--bd-cur)' : 'var(--line)') }}>
              <span style={{ width: 34, flex: 'none', fontFamily: 'var(--f-serif)', fontWeight: 700, fontSize: 20, color: l.ready ? 'var(--accent-ink)' : 'var(--color-neutral-500)', fontVariantNumeric: 'lining-nums tabular-nums' }}>{String(l.id).padStart(2, '0')}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {l.title ? (
                  <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</span>
                ) : (
                  // 제목이 비어 있으면 자리만
                  <span style={{ display: 'block', width: SKELETON_W[i % SKELETON_W.length], maxWidth: '100%', height: 12, margin: '3px 0', borderRadius: 999, background: 'var(--color-neutral-200)' }} />
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  {steps.map((st) => <span key={st} style={{ width: 18, height: 4, borderRadius: 999, background: l.ready && done.includes(st) ? 'var(--sage)' : 'var(--color-neutral-200)' }} />)}
                </div>
              </div>
              {all ? <Ic icon={Check} size={16} color="var(--sage)" /> : <Ic icon={ChevronRight} size={16} color={l.ready ? 'var(--accent-ink)' : 'var(--color-neutral-400)'} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 마이페이지 ───────────────────────────────
function Seg({ options, value, onPick, render }) {
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button key={o.v} onClick={() => onPick(o.v)} aria-pressed={on} className="press" style={{ flex: 1, padding: '12px 6px', textAlign: 'center', borderRadius: 999, background: on ? 'var(--accent-soft)' : 'var(--tile)', border: '1.5px solid ' + (on ? 'var(--bd-cur)' : 'var(--line)'), color: on ? 'var(--accent-ink)' : 'var(--muted)' }}>
            {render ? render(o) : <span style={{ font: "800 12.5px 'Noto Sans KR',sans-serif" }}>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label: text, on, onClick }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} className="press-card h-tile" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, textAlign: 'left' }}>
      <span style={{ flex: 1, font: "700 13.5px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>{text}</span>
      <span style={{ width: 40, height: 23, flex: 'none', borderRadius: 999, background: on ? 'var(--color-accent)' : 'var(--color-neutral-200)', border: '1.5px solid ' + (on ? 'var(--color-accent)' : 'var(--line)'), display: 'flex', alignItems: 'center', padding: 2, justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .18s' }}>
        <span style={{ width: 15, height: 15, borderRadius: 999, background: '#fffaf1' }} />
      </span>
    </button>
  );
}

function MyPage({ dash, setDash, narrow, onBack, onLogout }) {
  const { profile, stats, week, goal, sessions } = dash;
  const s = profile.settings;
  const [name, setName] = useState(profile.name);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const nameTimer = useRef(null);

  const patch = (body) => api('/api/me', { method: 'PATCH', body }).then(setDash).catch(() => {});
  // 설정은 바로 화면에 반영하고 서버에 저장
  const setSetting = (key, v) => {
    setDash({ ...dash, profile: { ...profile, settings: { ...s, [key]: v } } });
    if (key === 'greekSize') document.documentElement.style.setProperty('--gk-scale', GK_SCALE[v]);
    patch({ [key]: v });
  };
  const onName = (v) => {
    setName(v);
    clearTimeout(nameTimer.current);
    if (v.trim()) nameTimer.current = setTimeout(() => patch({ name: v }), 600);
  };
  useEffect(() => () => clearTimeout(nameTimer.current), []);

  // 최근 7일 선그래프
  const vals = week.map((d) => d.xp);
  const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => ((i * 280) / 6).toFixed(1) + ',' + (74 - (v / max) * 64).toFixed(1));
  const DN = ['일', '월', '화', '수', '목', '금', '토'];
  const dayLabel = (ymd, i) => (i === 6 ? '오늘' : DN[new Date(ymd + 'T00:00:00Z').getUTCDay()]);

  const sessionTitle = (r) => {
    const ls = r.lessons.length ? '제' + r.lessons.join('·') + '과' : '여러 과';
    return ls + ' · ' + (MODE_LABEL[r.mode] || r.mode);
  };
  const sessionSub = (r) => {
    const d = new Date(r.endedAt);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 · ${r.items}문항 · 정답률 ${r.acc}% · ${fmtDuration(r.sec)}`;
  };

  return (
    <div data-screen-label="마이페이지" style={{ maxWidth: 1080, margin: '0 auto', padding: narrow ? '24px 16px 40px' : '44px 28px 64px', display: 'flex', flexDirection: 'column', gap: 22, animation: 'pop .3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={onBack} title="목차로" aria-label="목차로" className="press h-tile" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--line)', color: 'var(--muted)' }}>
          <Ic icon={ArrowLeft} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--f-serif)', fontStyle: 'italic', fontSize: 14, letterSpacing: '.06em', color: 'var(--accent-ink)' }}>Ἐμοί</span>
          <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 900, fontSize: narrow ? 34 : 46, letterSpacing: '-.03em', lineHeight: 1.1, color: 'var(--ink)' }}>마이페이지</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : 'minmax(0,1.35fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        {/* 학습 기록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ padding: '0 4px' }}>
            <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>학습 기록</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
            {[
              { icon: Sparkles, k: '누적 경험치', v: stats.xp.toLocaleString(), c: 'var(--color-accent)' },
              { icon: Flame, k: '연속 학습', v: stats.streak + '일', c: 'var(--color-accent)' },
              { icon: CalendarCheck, k: '총 학습일수', v: stats.days + '일', c: 'var(--sage)' },
            ].map((m) => (
              <div key={m.k} style={{ ...card, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Ic icon={m.icon} size={18} color={m.c} />
                <span style={{ fontFamily: 'var(--f-serif)', fontWeight: 700, fontSize: narrow ? 24 : 30, lineHeight: 1.1, color: 'var(--ink)', fontVariantNumeric: 'lining-nums tabular-nums' }}>{m.v}</span>
                <span style={{ font: "700 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{m.k}</span>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ flex: 1, font: "800 13px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>최근 7일 경험치</span>
              <span style={{ font: "700 12px 'Figtree',sans-serif", color: 'var(--muted)' }}>합계 {vals.reduce((a, b) => a + b, 0).toLocaleString()} XP</span>
            </div>
            <svg viewBox="0 0 280 80" preserveAspectRatio="none" style={{ width: '100%', height: 120, display: 'block', overflow: 'visible' }} aria-hidden="true">
              <polyline points={'0,80 ' + pts.join(' ') + ' 280,80'} fill="var(--color-accent-100)" stroke="none" />
              <polyline points={pts.join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginTop: -6 }}>
              {week.map((d, i) => {
                const today = i === 6;
                return (
                  <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ font: "800 11px 'Figtree',sans-serif", color: today ? 'var(--accent-ink)' : 'var(--muted)' }}>{d.xp ? d.xp : '·'}</span>
                    <span style={{ font: "700 11px 'Noto Sans KR',sans-serif", color: today ? 'var(--accent-ink)' : 'var(--muted)' }}>{dayLabel(d.date, i)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <GoalCard goal={goal} style={card} />

          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: "800 13px 'Noto Sans KR',sans-serif", color: 'var(--ink)', marginBottom: 6 }}>최근 학습</span>
            {!sessions.length && <span style={{ font: "500 13px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>아직 끝낸 학습이 없습니다. 첫 학습을 마치면 여기에 기록됩니다.</span>}
            {sessions.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 12px 'Noto Sans KR',sans-serif" }}>{(MODE_LABEL[r.mode] || '').slice(0, 1)}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: "700 13.5px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>{sessionTitle(r)}</span>
                  <span style={{ font: "500 11.5px 'Noto Sans KR',sans-serif", color: 'var(--muted)' }}>{sessionSub(r)}</span>
                </div>
                <span style={{ font: "800 13px 'Figtree',sans-serif", color: 'var(--accent-ink)' }}>+{r.xp} XP</span>
              </div>
            ))}
          </div>
        </div>

        {/* 설정 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ padding: '0 4px' }}>
            <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>설정</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '20px 22px', borderRadius: 30, background: 'radial-gradient(120% 140% at 90% 0%, var(--color-accent-100) 0%, #fffaf1 60%)', border: '1.5px solid var(--bd-cur)' }}>
            <Avatar profile={{ ...profile, name }} size={56} fontSize={22} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontFamily: 'var(--f-serif-kr)', fontWeight: 700, fontSize: 21, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ font: "500 12.5px 'Figtree',sans-serif", color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</span>
            </div>
            <div style={{ flex: 'none', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={label}>내 초대 코드</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: "800 16px 'Figtree',sans-serif", letterSpacing: '.14em', color: 'var(--ink)' }}>{profile.inviteCode}</span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(profile.inviteCode).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }}
                  className="press"
                  style={{ flex: 'none', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, background: 'var(--card)', border: '1.5px solid var(--bd-cur)', font: "800 11.5px 'Noto Sans KR',sans-serif", color: 'var(--accent-ink)' }}
                >
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={label}>이름</span>
              <input value={name} onChange={(e) => onName(e.target.value)} maxLength={30} placeholder="이름을 입력하세요" style={{ width: '100%', padding: '13px 18px', borderRadius: 999, background: 'var(--tile)', border: '1.5px solid var(--line)', outline: 'none', color: 'var(--ink)', font: "600 14px 'Noto Sans KR',sans-serif" }} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={label}>언어</span>
              <Seg options={[{ v: 'ko', label: '한국어' }, { v: 'en', label: 'English' }, { v: 'ja', label: '日本語' }]} value={s.lang} onPick={(v) => setSetting('lang', v)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={label}>하루 목표</span>
              <Seg options={[10, 20, 30].map((v) => ({ v, label: v + '문항' }))} value={goal.goal} onPick={(v) => patch({ goal: v })} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={label}>그리스어 글자 크기</span>
              <Seg
                options={[{ v: 'm', px: 15 }, { v: 'l', px: 18 }, { v: 'xl', px: 22 }]}
                value={s.greekSize}
                onPick={(v) => setSetting('greekSize', v)}
                render={(o) => <span style={{ fontFamily: 'var(--f-serif)', fontWeight: 700, fontSize: o.px }}>Αα</span>}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={label}>화면 모드</span>
              <Seg options={[{ v: 'light', label: '라이트' }, { v: 'dark', label: '다크' }]} value={s.mode} onPick={(v) => setSetting('mode', v)} />
            </div>
          </div>

          <div style={{ ...card, padding: '6px 8px', display: 'flex', flexDirection: 'column' }}>
            <Toggle label="학습 알림" on={s.remind} onClick={() => setSetting('remind', !s.remind)} />
            <Toggle label="효과음" on={s.sound} onClick={() => setSetting('sound', !s.sound)} />
          </div>

          <div style={{ ...card, padding: '6px 8px', display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true);
                setConfirmReset(false);
                api('/api/me/reset', { method: 'POST' }).then(setDash).catch(() => {});
              }}
              className="press-card h-tile"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, textAlign: 'left' }}
            >
              <Ic icon={RotateCcw} size={17} color="var(--muted)" />
              <span style={{ flex: 1, font: "700 13.5px 'Noto Sans KR',sans-serif", color: confirmReset ? 'var(--color-accent-700)' : 'var(--ink)' }}>
                {confirmReset ? '한 번 더 누르면 모든 학습 기록이 지워집니다' : '학습 기록 초기화'}
              </span>
            </button>
            <button onClick={onLogout} className="press-card h-tile" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, textAlign: 'left' }}>
              <Ic icon={LogOut} size={17} color="var(--muted)" />
              <span style={{ flex: 1, font: "700 13.5px 'Noto Sans KR',sans-serif", color: 'var(--ink)' }}>로그아웃</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
