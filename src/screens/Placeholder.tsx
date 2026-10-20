// 2단계 빈 화면 (학습·테스트·마이페이지). 다음 단계에서 실제 화면으로 바뀜
import BookPages from '../components/book/BookPages';

export default function Placeholder({ title }: { title: string }) {
  return (
    <BookPages
      left={<h1 style={{ margin: 0, fontSize: 32 }}>{title}</h1>}
      right={<p style={{ margin: 0, color: 'var(--muted)' }}>오른쪽 쪽</p>}
    />
  );
}
