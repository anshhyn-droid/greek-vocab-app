# 성경 헬라어 학습 웹 (제3과)

Next.js 16 + SQLite(@libsql/client). 개발은 `data/db.sqlite` 파일, 배포는 Turso. 컴퓨터·폰 반응형(700px 기준).

## 처음 실행

```bash
npm install
npm run seed      # 엑셀(../제3과_헬라어_학습DB.xlsx) → data/db.sqlite
npm run dev       # http://localhost:3000/start
```

다른 엑셀을 넣으려면 `node data/seed.js <엑셀 경로>`. 시드는 콘텐츠 표만 다시 만들고 사용자 기록은 지우지 않습니다.

### Google 로그인 설정

`.env.local`을 만들고 Google Cloud Console의 OAuth 클라이언트(웹 애플리케이션) 값을 넣습니다.

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# 배포 주소가 요청 주소와 다를 때만
# APP_URL=https://example.com
```

승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google` (배포 시 그 주소로 하나 더)

설정이 없으면 시작 화면에서 "Google 로그인 설정이 아직 없습니다"가 뜹니다.

## 배포 (Vercel + Turso, 무료)

1. **Turso DB 만들기** — https://turso.tech 가입 → Create Database (지역: Tokyo 등 가까운 곳)
   → DB 화면에서 URL(`libsql://…`)과 토큰(Create Token)을 복사
2. **콘텐츠 넣기** — 이 컴퓨터에서
   ```bash
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run seed
   ```
   사용자 표는 앱이 처음 켜질 때 자동으로 만들어집니다.
3. **Vercel 배포** — https://vercel.com 에 GitHub로 가입 → Add New → Project → 이 저장소 Import
   → Environment Variables에 넣고 Deploy
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   TURSO_DATABASE_URL=libsql://...
   TURSO_AUTH_TOKEN=...
   ```
4. **Google 콘솔** — 승인된 리디렉션 URI에 `https://<배포 주소>/api/auth/callback/google` 추가,
   OAuth 동의 화면에서 "앱 게시"(테스트 사용자 외 누구나 로그인)

엑셀을 고친 뒤에는 2번만 다시 하면 됩니다(사용자 기록은 그대로).

## 주소

| 주소 | 화면 |
|---|---|
| `/start` | 시작(로그인) · 목차 · 마이페이지 |
| `/review` | 암기 |
| `/` | 과 메뉴 |
| `/word` · `/grammar` · `/sentence` | 단어 · 문법 · 문장 학습 |

`/start` 말고는 로그인해야 들어갈 수 있습니다.

## 구조

```
data/
  seed.js            엑셀 → DB (열 이름은 엑셀 머리글 그대로, "none"은 NULL)
  schema.sql         사용자 표 (users, lesson_progress, study_sessions, wrong_notes …)
src/styles/tokens.css  공통 색·글꼴·모서리 토큰
src/lib/
  content.js         문항 만들기 (단어 보기, 문법 무작위 20, 문장 블록·원형 보기, 암기)
  koTraps.js         해석 함정 낱말 자동 규칙 (인칭·격·시제·법·태·문형)
  reward.js          보상 계산 (경험치 = 데나리온, 반복 감소·복습 보너스)
  record.js          완료 기록 저장 (오답 노트·연속 학습·하루 기록·과 진도)
  progress.js        화면이 완료 기록을 읽고 쓰는 유일한 곳
  auth.js · users.js Google 로그인 세션, 첫 로그인 기본 행
src/components/      나가기 확인 창, 불러오기 실패, 진행 동그라미, 결과 칸, 훅
src/app/             화면과 API (api/…)
```
