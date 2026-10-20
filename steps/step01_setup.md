# 1단계 · 프로젝트 뼈대와 데이터

아래 블록을 복사해 Antigravity 에이전트에 붙여넣으세요.

```text
1단계: 프로젝트 뼈대와 데이터

먼저 steps/00_공통규칙.md를 끝까지 읽고 지켜 줘.
참고할 파일: data/ 폴더 전체, design/Start.dc.html (색·글꼴)

기술 스택: React + Vite + TypeScript. 라우팅은 react-router. 스타일은 CSS 변수 + CSS Modules(또는 원하는 방식) — 색·글꼴 값은 공통 규칙의 표를 그대로 쓴다.

할 일
1. 프로젝트를 만들고 src/ 아래 폴더를 나눈다: app(라우팅), components(공용), screens(화면), data(콘텐츠 불러오기), lib(저장·채점 규칙), styles.
2. data/*.json을 public/data로 옮기고, 타입(Lesson, Word, GrammarItem, Sentence, Parsing, Concepts)을 만든다. 과 번호로 불러오는 함수 loadLesson(n)과 모든 과 단어를 id로 찾는 함수를 만든다.
3. 글꼴을 연결한다: Hahmlet(Google Fonts), Pretendard Variable(CDN), Gentium Book Plus(Google Fonts). design/greek-font.css를 참고해 헬라어 글꼴을 하나로 통일한다.
4. 색 변수를 전역 CSS에 넣는다.
5. 임시 화면 하나에서 제3과 단어 목록과 문법 개념 표 첫 묶음을 그려서 데이터가 제대로 불러와지는지 보여 준다.

끝나면 아래 "완료 확인"을 직접 확인하고, 바꾼 파일 목록과 확인 결과를 알려 줘.
```

## 완료 확인
- [ ] npm run dev로 열린다
- [ ] 제3과 단어 9개, 제8과 문법 테스트 문항 300개가 불러와진다
- [ ] 헬라어가 Gentium Book Plus 한 글꼴로 보인다
