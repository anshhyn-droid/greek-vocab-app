# ΛΟΓΟΣ · 성경 헬라어 학습

React + Vite + TypeScript 화면 + Vercel 서버 함수(`api/`, `server/`) + Turso(SQLite). 단계별 작업 묶음(`steps/`)과 시안(`design/`)을 따라 만듭니다.
(단계 문서는 Supabase 기준이지만 Turso로 바꿨습니다. 표·열은 `db/schema.sql`과 같고, SQLite판은 `db/schema.turso.sql`)

## 실행

```bash
npm install
cp .env.example .env   # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev            # http://localhost:3000  (화면 + /api 함께)
```

- 개발 중 DB는 `data/local.sqlite` 파일(자동 생성). `TURSO_DATABASE_URL`을 넣으면 Turso를 씀
- 표는 서버가 처음 시작할 때 `db/schema.turso.sql`로 만듦(여러 번 실행해도 됨)
- 콘텐츠: `public/data/*.json` (변환 스크립트와 점검 결과는 `data/`)
- 데이터 확인 화면: `/data-check`

## 왜 서버가 있나
Turso는 DB만 제공하므로, 브라우저가 직접 접속하면 DB 토큰이 공개됩니다. 그래서 `/api`(Vercel 서버 함수 하나, `api/index.ts`)가 로그인·DB를 맡고,
브라우저에는 HttpOnly 세션 쿠키만 둡니다. 모든 API는 세션의 사용자 id로만 조회·수정합니다(Supabase의 행 보안 대신).

## Google 로그인
Google Cloud Console의 OAuth 클라이언트 → 승인된 리디렉션 URI
- 개발: `http://localhost:3000/api/auth/callback/google`
- 배포: `https://<배포 주소>/api/auth/callback/google`

## 배포 (Vercel + Turso)
1. Turso에서 새 DB를 만들고 URL과 토큰을 받습니다.
2. Vercel에서 이 저장소를 Import, 환경 변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. `vercel.json`이 `/api/*`를 서버 함수로, 나머지는 `index.html`로 보냅니다.

## 로그인 흐름
- 첫 화면 = 닫힌 책 표지 → 눌러서 펼치기 → "Google로 계속하기"
- 처음 가입이면 약관 동의(만 14세 이상·이용약관·개인정보 수집·이용, 모두 필수). 동의하기 전에는 계정을 만들지 않고(Google 정보는 10분짜리 암호화 쿠키에만), 동의하면 users, user_consents, user_settings, user_goals, user_stats 기본 행을 한 번에 만듭니다.
- 마지막 활동(클릭·키 입력) 후 24시간이 지나면 로그아웃되고 첫 화면에 안내가 나옵니다. 화면은 `localStorage`의 `gk_last_active`로, 서버는 `auth_sessions.idle_expires_at`(요청마다 연장)으로 판단합니다. 1분 전에 안내 창.
- 로그아웃하면 기기(localStorage)의 `gk_` 학습 정보를 지웁니다.
