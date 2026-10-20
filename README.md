# ΛΟΓΟΣ · 성경 헬라어 학습

React + Vite + TypeScript + Supabase. 단계별 작업 묶음(`steps/`)과 시안(`design/`)을 따라 만듭니다.

## 실행

```bash
npm install
cp .env.example .env   # 아래 Supabase 값을 채움
npm run dev            # http://localhost:5173
```

- 콘텐츠: `public/data/*.json` (변환 스크립트와 점검 결과는 `data/`)
- 데이터 확인 화면: `/data-check`

## Supabase 설정

### 1. 프로젝트 만들기
1. https://supabase.com 에서 가입 → **New project** (지역: Northeast Asia (Seoul) 또는 Tokyo)
2. **Project Settings → API**에서 두 값을 `.env`에 넣습니다.
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...   (anon public 키)
   ```

### 2. 표 만들기 (`db/schema.sql`)
1. 왼쪽 **SQL Editor → New query**
2. `db/schema.sql` 내용을 전부 붙여 넣고 **Run**
3. **Table Editor**에 users, user_consents, user_settings … 표가 생겼는지 확인

### 3. Google 로그인 켜기
1. Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트(웹 애플리케이션)
   - 승인된 리디렉션 URI: `https://xxxx.supabase.co/auth/v1/callback`
2. Supabase **Authentication → Sign In / Providers → Google**을 켜고 클라이언트 ID·보안 비밀번호를 넣습니다.
3. Supabase **Authentication → URL Configuration**
   - Site URL: 배포 주소 (개발 중에는 `http://localhost:5173`)
   - Redirect URLs: `http://localhost:5173/**`, 배포 주소 `/**`

## 로그인 흐름
- 첫 화면 = 닫힌 책 표지 → 눌러서 펼치기 → "Google로 계속하기"
- 처음 가입이면 약관 동의(만 14세 이상·이용약관·개인정보 수집·이용, 모두 필수). 동의하면 users, user_consents, user_settings, user_goals, user_stats 기본 행을 만듭니다.
- 마지막 활동(클릭·키 입력) 후 24시간이 지나면 로그아웃되고 첫 화면에 안내가 나옵니다. 활동 시각은 `localStorage`의 `gk_last_active`.
- 로그아웃하면 기기(localStorage)의 `gk_` 학습 정보를 지웁니다.
