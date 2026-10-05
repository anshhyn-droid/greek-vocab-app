import Link from 'next/link';

export const metadata = { title: '개인정보처리방침 · 성경 헬라어' };

const CONTACT = 'lego.scripturam@gmail.com';

// 로그인 없이 보는 화면 (Google OAuth 동의 화면에 연결)
export default function Page() {
  const h2 = { font: "800 17px 'Noto Sans KR',sans-serif", margin: '32px 0 10px' };
  const p = { font: "400 15px/1.75 'Noto Sans KR',sans-serif", margin: '0 0 8px' };
  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
        <Link href="/start" style={{ font: "700 13px 'Noto Sans KR',sans-serif", color: 'var(--color-accent-700)' }}>← 시작 화면</Link>
        <h1 style={{ font: "900 30px 'Noto Serif KR',serif", margin: '18px 0 6px' }}>개인정보처리방침</h1>
        <p style={{ ...p, color: 'var(--muted)' }}>시행일: 2026년 10월 5일</p>

        <h2 style={h2}>1. 수집하는 정보</h2>
        <p style={p}>Google 로그인 시 Google이 제공하는 계정 식별자, 이메일 주소, 이름, 프로필 사진 주소를 받습니다.</p>
        <p style={p}>앱을 사용하면서 생기는 학습 기록(푼 문항, 정답 여부, 학습 시간, 경험치, 연속 학습, 오답 노트, 즐겨찾기, 화면 설정)을 저장합니다.</p>

        <h2 style={h2}>2. 이용 목적</h2>
        <p style={p}>로그인 상태 유지, 학습 진도와 기록 저장, 복습 문항 구성에만 사용합니다. 광고나 마케팅에 쓰지 않으며 제3자에게 판매하거나 제공하지 않습니다.</p>

        <h2 style={h2}>3. 쿠키</h2>
        <p style={p}>로그인 상태를 유지하는 세션 쿠키와, 로그인 과정의 보안 확인용 쿠키만 사용합니다. 분석·광고 쿠키는 쓰지 않습니다.</p>

        <h2 style={h2}>4. 보관과 처리 위탁</h2>
        <p style={p}>정보는 Turso(데이터베이스, 일본 도쿄 지역)에 저장되고 Vercel(웹 호스팅)을 통해 제공됩니다. 계정 삭제를 요청할 때까지 보관합니다.</p>

        <h2 style={h2}>5. 열람·삭제</h2>
        <p style={p}>마이페이지에서 학습 기록을 초기화할 수 있습니다. 계정과 모든 정보의 삭제를 원하시면 아래 이메일로 요청해 주세요. 확인 후 지체 없이 삭제합니다.</p>

        <h2 style={h2}>6. 문의</h2>
        <p style={p}>
          <a href={`mailto:${CONTACT}`} style={{ color: 'var(--color-accent-700)', fontWeight: 700 }}>{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
