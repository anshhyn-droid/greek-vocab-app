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
        <p style={{ ...p, color: 'var(--muted)' }}>시행일: 2026년 10월 20일</p>

        <h2 style={h2}>1. 수집하는 정보와 동의</h2>
        <p style={p}>처음 로그인할 때 만 14세 이상 확인, 이용약관, 개인정보 수집·이용에 대한 동의(모두 필수)를 받은 뒤 가입이 이루어집니다. 동의하지 않으면 정보를 저장하지 않습니다.</p>
        <p style={p}>Google 로그인으로 계정 식별자, 이름, 이메일 주소만 받습니다. 프로필 사진은 받거나 저장하지 않습니다. Google의 로그인 토큰은 본인 확인에만 쓰고 저장하지 않습니다.</p>
        <p style={p}>앱을 사용하면서 생기는 학습 기록(푼 문항, 정답 여부, 학습 시간, 경험치, 연속 학습, 오답 노트, 즐겨찾기, 화면 설정)과 동의 기록을 저장합니다.</p>

        <h2 style={h2}>2. 이용 목적</h2>
        <p style={p}>계정 확인과 학습 기록 저장·동기화에만 사용합니다. 광고나 마케팅에 쓰지 않으며 제3자에게 판매하거나 제공하지 않습니다. 화면에는 이메일의 앞 두 글자만 표시합니다.</p>

        <h2 style={h2}>3. 쿠키와 자동 로그아웃</h2>
        <p style={p}>로그인 상태를 유지하는 세션 쿠키와, 요청 위조를 막고 로그인 과정을 확인하는 보안용 쿠키만 사용합니다. 분석·광고 쿠키는 쓰지 않습니다.</p>
        <p style={p}>하루 동안 사용하지 않으면 자동으로 로그아웃되고, 계속 사용해도 로그인 후 30일이 지나면 다시 로그인해야 합니다.</p>

        <h2 style={h2}>4. 접속 기록</h2>
        <p style={p}>보안을 위해 로그인·로그아웃·탈퇴·기록 초기화 시각, 뒷부분을 가린 IP 주소, 브라우저·운영체제 종류를 남깁니다. 이메일 등은 남기지 않으며 3개월이 지나면 삭제합니다.</p>

        <h2 style={h2}>5. 보관과 처리 위탁</h2>
        <p style={p}>정보는 Turso(데이터베이스, 일본 도쿄 지역)에 저장되고 Vercel(웹 호스팅)을 통해 제공됩니다. 탈퇴할 때까지 보관합니다.</p>

        <h2 style={h2}>6. 열람·삭제와 탈퇴</h2>
        <p style={p}>마이페이지에서 학습 기록을 초기화하거나, 맨 아래 &quot;회원 탈퇴&quot;로 계정을 지울 수 있습니다. 탈퇴하면 계정과 학습 기록, 동의 기록이 바로 삭제되며, 접속 기록은 누구의 것인지 알 수 없게 만든 뒤 3개월 후 삭제합니다.</p>
        <p style={p}>Google 계정의 &quot;서드 파티 연결&quot; 목록에서 이 앱의 연결도 직접 해제할 수 있습니다.</p>

        <h2 style={h2}>7. 문의</h2>
        <p style={p}>
          <a href={`mailto:${CONTACT}`} style={{ color: 'var(--color-accent-700)', fontWeight: 700 }}>{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
