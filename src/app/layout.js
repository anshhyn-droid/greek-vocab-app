import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import { getSettings, GREEK_SCALE } from '@/lib/users';

export const metadata = {
  title: '성경 헬라어',
  description: '성경 헬라어 단어·문법·문장 학습',
};

export const viewport = { width: 'device-width', initialScale: 1 };

const FONTS =
  'https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;600;700;800' +
  '&family=Gentium+Book+Plus:wght@400;700&family=Noto+Sans+KR:wght@400;500;600;700;800' +
  '&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&family=Noto+Serif+KR:wght@500;700;900&display=swap';

export default async function RootLayout({ children }) {
  // 설정의 그리스어 글자 크기를 모든 화면에 적용
  const user = await getCurrentUser();
  const size = user ? (await getSettings(user.id))?.greek_size : 'm';
  return (
    <html lang="ko" style={{ '--gk-scale': GREEK_SCALE[size] || 1 }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
