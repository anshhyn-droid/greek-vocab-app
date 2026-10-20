// /study/:n/:type → 단어·문법·문장 학습 화면
import { Navigate, useParams } from 'react-router-dom';
import GrammarStudy from './GrammarStudy';
import SentenceStudy from './SentenceStudy';
import WordStudy from './WordStudy';

const READY = [3, 4, 5, 6, 7, 8];

export default function StudyRoute() {
  const { n, type } = useParams();
  const num = Number(n);
  if (!READY.includes(num)) return <Navigate to="/learn" replace />;
  // 과·종류가 바뀌면 화면 상태를 새로
  if (type === 'word') return <WordStudy key={`w${num}`} n={num} />;
  if (type === 'gram') return <GrammarStudy key={`g${num}`} n={num} />;
  if (type === 'sent') return <SentenceStudy key={`s${num}`} n={num} />;
  return <Navigate to="/learn" replace />;
}
