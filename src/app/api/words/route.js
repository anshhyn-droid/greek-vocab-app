import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// 배열을 무작위로 섞는 유틸리티 함수
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET() {
  try {
    const db = getDb();
    
    // 제3과(L03) 단어 목록을 가져옵니다.
    const words = db.prepare(`SELECT * FROM words WHERE lesson_id = 'L03'`).all();
    
    if (!words || words.length === 0) {
      return NextResponse.json({ error: 'No words found for L03' }, { status: 404 });
    }

    // 각 단어별로 문항과 4지선다 보기를 생성합니다.
    const quizData = words.map(targetWord => {
      const correctMeaning = targetWord.meaning;
      
      // 오답 보기 풀(pool): 정답과 뜻이 다른 단어들의 뜻 모음
      const wrongMeaningsSet = new Set();
      words.forEach(w => {
        if (w.meaning !== correctMeaning && w.meaning !== null) {
          wrongMeaningsSet.add(w.meaning);
        }
      });
      
      const wrongMeaningsPool = Array.from(wrongMeaningsSet);
      
      // 오답 풀에서 3개를 무작위로 추출
      const shuffledWrongs = shuffle(wrongMeaningsPool);
      const selectedWrongs = shuffledWrongs.slice(0, 3);
      
      // 정답 1개 + 오답 3개 합치기
      const choices = [correctMeaning, ...selectedWrongs];
      
      // 최종 4개 보기를 다시 섞기
      const shuffledChoices = shuffle(choices);
      
      return {
        id: targetWord.word_id, // 단어 고유 ID
        g: targetWord.word,     // 헬라어 표기
        m: correctMeaning,      // 정답 뜻
        ch: shuffledChoices     // 섞인 4개 보기
      };
    });
    
    // 서버에서 전체 문항 순서도 한 번 섞어서 내려줍니다.
    const shuffledQuizData = shuffle(quizData);

    return NextResponse.json(shuffledQuizData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
