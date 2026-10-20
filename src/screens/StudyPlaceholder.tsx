// 5~7단계에서 실제 학습 화면으로 바뀜
import { useNavigate, useParams } from 'react-router-dom';
import BookPages from '../components/book/BookPages';

const NAME: Record<string, string> = { word: '단어', gram: '문법', sent: '문장' };

export default function StudyPlaceholder() {
  const { n, type } = useParams();
  const navigate = useNavigate();
  return (
    <BookPages
      left={<button onClick={() => navigate(`/learn/${n}`)} style={{ alignSelf: 'flex-start', font: '700 18px var(--f-title)' }}>← {n}과 | {NAME[type!] ?? type}</button>}
      right={<p style={{ color: 'var(--muted)' }}>준비 중</p>}
    />
  );
}
