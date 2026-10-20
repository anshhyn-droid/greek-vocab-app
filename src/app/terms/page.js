import Link from 'next/link';

export const metadata = { title: '이용약관 · 성경 헬라어' };

const CONTACT = 'lego.scripturam@gmail.com';

// 로그인 없이 보는 화면. 임시 문안 — 실제 약관이 정해지면 교체하고 lib/consent.js의 버전을 올림
export default function Page() {
  const h2 = { font: "800 17px 'Noto Sans KR',sans-serif", margin: '32px 0 10px' };
  const p = { font: "400 15px/1.75 'Noto Sans KR',sans-serif", margin: '0 0 8px' };
  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
        <Link href="/start" style={{ font: "700 13px 'Noto Sans KR',sans-serif", color: 'var(--color-accent-700)' }}>← 시작 화면</Link>
        <h1 style={{ font: "900 30px 'Noto Serif KR',serif", margin: '18px 0 6px' }}>이용약관</h1>
        <p style={{ ...p, color: 'var(--muted)' }}>시행일: 2026년 10월 20일</p>

        <h2 style={h2}>1. 서비스</h2>
        <p style={p}>성경 헬라어 학습 앱(이하 &quot;서비스&quot;)은 단어·문법·문장 학습과 복습 기능을 무료로 제공합니다.</p>

        <h2 style={h2}>2. 가입과 이용</h2>
        <p style={p}>만 14세 이상이면 Google 계정으로 가입할 수 있습니다. 가입하면 이 약관과 개인정보 수집·이용에 동의한 것으로 봅니다.</p>
        <p style={p}>하루 동안 사용하지 않으면 자동으로 로그아웃되며, 로그인 후 30일이 지나면 다시 로그인해야 합니다.</p>

        <h2 style={h2}>3. 이용자의 의무</h2>
        <p style={p}>다른 사람의 계정을 쓰거나, 비정상적인 방법으로 기록·경험치를 조작하거나, 서비스 운영을 방해해서는 안 됩니다. 이런 경우 이용이 제한될 수 있습니다.</p>

        <h2 style={h2}>4. 학습 콘텐츠</h2>
        <p style={p}>서비스의 문제와 해설은 학습용으로 제공하며, 내용을 다른 곳에 옮겨 배포하려면 미리 문의해 주세요.</p>

        <h2 style={h2}>5. 서비스 변경과 중단</h2>
        <p style={p}>서비스는 개선을 위해 바뀌거나 사전 안내 후 중단될 수 있습니다. 무료 서비스이므로 이로 인한 손해는 법이 정한 경우를 빼고 책임지지 않습니다.</p>

        <h2 style={h2}>6. 탈퇴</h2>
        <p style={p}>마이페이지 맨 아래 &quot;회원 탈퇴&quot;에서 언제든 탈퇴할 수 있습니다. 탈퇴하면 계정과 학습 기록이 바로 삭제됩니다.</p>

        <h2 style={h2}>7. 약관 변경</h2>
        <p style={p}>약관을 바꾸면 다음 로그인 때 알리고 다시 동의를 받습니다.</p>

        <h2 style={h2}>8. 문의</h2>
        <p style={p}>
          <a href={`mailto:${CONTACT}`} style={{ color: 'var(--color-accent-700)', fontWeight: 700 }}>{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
