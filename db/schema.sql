-- 성경 헬라어 학습 앱 · 사용자 DB (Supabase / PostgreSQL)
-- 사용자_DB.xlsx의 '컬럼' 시트에서 만들었습니다. 콘텐츠(단어·문법·문장)는 data/*.json 정적 파일로 두고 DB에 넣지 않습니다.

create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade, -- 사용자 고유 번호. 다른 테이블이 모두 이 값으로 사용자를 가리킴
  google_sub text not null, -- Google 로그인 고유 ID. 다시 로그인하면 이 값으로 기존 계정을 찾음
  email text not null, -- Google 계정 이메일. 화면에는 앞 두 글자만 표시
  display_name text not null, -- 앱에 보이는 이름. Google 계정 이름을 그대로 씀
  created_at timestamptz not null default now(), -- 가입 일시
  last_login_at timestamptz not null default now(), -- 마지막 로그인 일시
  primary key (id)
);
alter table public.users enable row level security;
create policy "users: 본인만" on public.users for all using (id = auth.uid()) with check (id = auth.uid());

create table if not exists public.user_consents (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  type text, -- age(만 14세 이상) / terms(이용약관) / privacy(개인정보 수집·이용). 모두 필수
  version text, -- 동의한 약관 버전. 약관이 바뀌면 다음 로그인 때 새 버전으로 다시 받음
  agreed boolean not null, -- 동의 여부
  agreed_at timestamptz not null default now(), -- 동의한 시각
  primary key (user_id, type, version)
);
alter table public.user_consents enable row level security;
create policy "user_consents: 본인만" on public.user_consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.auth_sessions (
  id text, -- 세션 쿠키 값의 해시. 쿠키 원문은 저장하지 않음
  user_id uuid not null references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  created_at timestamptz not null default now(), -- 로그인한 시각
  last_seen_at timestamptz not null default now(), -- 마지막 요청 시각. 요청이 올 때마다 갱신
  idle_expires_at timestamptz not null, -- 이 시각이 지나면 자동 로그아웃
  absolute_expires_at timestamptz not null, -- 계속 사용해도 이 시각이 지나면 다시 로그인
  ended_at timestamptz, -- 세션이 끝난 시각
  end_reason text, -- logout(직접) / idle(하루 미사용) / absolute(30일) / withdraw(탈퇴)
  primary key (id)
);
alter table public.auth_sessions enable row level security;
create policy "auth_sessions: 본인만" on public.auth_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.user_settings (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  font_size text not null, -- 글자 크기. m / l / xl (마이페이지 설정)
  timezone text not null, -- '오늘'의 기준 시간대. 매일 0시 초기화와 연속 학습 계산에 씀
  updated_at timestamptz not null default now(), -- 마지막 변경 시각
  primary key (user_id)
);
alter table public.user_settings enable row level security;
create policy "user_settings: 본인만" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.user_goals (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  goal_word integer not null default 8, -- 하루 단어 문항 목표. 목표 수정 팝업에서 조절
  goal_gram integer not null default 4, -- 하루 문법 문항 목표
  goal_sent integer not null default 8, -- 하루 문장 문항 목표
  updated_at timestamptz not null default now(), -- 마지막 변경 시각
  primary key (user_id)
);
alter table public.user_goals enable row level security;
create policy "user_goals: 본인만" on public.user_goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.user_stats (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  xp_total integer not null default 0, -- 누적 경험치. 서버가 계산해 더함(기기가 보낸 값은 쓰지 않음)
  streak_current integer not null default 0, -- 현재 연속 학습 일수
  streak_best integer not null default 0, -- 최고 연속 학습 일수
  study_days integer not null default 0, -- 총 학습일수
  last_study_date date, -- 마지막으로 학습한 날(사용자 시간대 기준). 연속 여부 판단
  primary key (user_id)
);
alter table public.user_stats enable row level security;
create policy "user_stats: 본인만" on public.user_stats for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.daily_activity (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  date date, -- 사용자 시간대 기준 날짜. 날짜가 바뀌면 새 행이 생기므로 목표가 0부터 시작
  word_done integer not null default 0, -- 그날 통과한 단어 문항 수. 학습에서 문항이 통과될 때 +1, 테스트(단어·플래시 카드)에서 한 번에 맞힐 때 +1
  gram_done integer not null default 0, -- 그날 통과한 문법 문항 수(학습 통과 + 테스트 한 번에 맞힘)
  sent_done integer not null default 0, -- 그날 통과한 문장 문항 수(학습 통과 + 테스트 한 번에 맞힘)
  test_items integer not null default 0, -- 그날 테스트에서 푼 문항 수(통계용)
  xp_earned integer not null default 0, -- 그날 얻은 경험치. 최근 7일 표시
  study_ms bigint not null default 0, -- 그날 학습·테스트 시간 합계(밀리초)
  primary key (user_id, date)
);
alter table public.daily_activity enable row level security;
create policy "daily_activity: 본인만" on public.daily_activity for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.lesson_progress (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  lesson_id integer, -- 몇 과인지(1~26). lessons는 콘텐츠 엑셀의 Lesson 시트
  type text, -- word / gram / sent
  status text not null, -- not_started / in_progress / done
  completed_at timestamptz, -- 처음 끝까지 마친 시각
  completed_count integer not null default 0, -- 끝까지 마친 횟수
  primary key (user_id, lesson_id, type)
);
alter table public.lesson_progress enable row level security;
create policy "lesson_progress: 본인만" on public.lesson_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.study_runs (
  id uuid default gen_random_uuid(), -- 회차 ID. 시작할 때 서버가 발급하고, 이어서 하면 같은 ID를 계속 씀
  user_id uuid not null references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  kind text not null, -- study(학습) / test(테스트)
  type text not null, -- 학습: word / gram / sent. 테스트: mix(단어·문법·문장 섞기) / flash(플래시 카드)
  lesson_ids text not null, -- 학습은 1개, 테스트는 고른 과 여러 개(쉼표)
  test_options jsonb, -- 테스트 설정(고른 종류, 문항 수 등). 학습은 비움
  content_version text not null, -- 시작할 때의 문제 데이터 버전. 이어서 할 때 지금 버전과 비교
  status text not null, -- in_progress / done / abandoned. 테스트는 나가면 abandoned(처음부터)
  queue jsonb not null, -- 남은 문항 ID 순서. 틀린 문항은 뒤에 다시 붙음
  item_total integer not null, -- 전체 문항 수. 진행 숫자 N / M의 M
  passed_count integer not null default 0, -- 통과한 문항 수(맞혀서 다시 안 나옴). 진행 숫자 N / M의 N
  first_try_correct integer not null default 0, -- 한 번에 맞힌 문항 수
  extra_state jsonb, -- 종류별 추가 정보. 단어 학습의 바퀴(1/2), 플래시 카드 앎/모름 수 등
  elapsed_ms bigint not null default 0, -- 소요 시간(밀리초). 나가 있던 시간은 세지 않음
  rev bigint not null default 0, -- 저장할 때마다 +1. 다른 탭·기기의 오래된 저장이 최신 진도를 덮어쓰지 못하게 함
  xp_earned integer not null default 0, -- 이 회차에서 얻은 경험치. 서버가 계산
  started_at timestamptz not null default now(), -- 시작 시각
  updated_at timestamptz not null default now(), -- 마지막 저장 시각
  ended_at timestamptz, -- 끝낸 시각
  expires_at timestamptz, -- 학습만. 이 시각이 지나면 이어서 하기를 버리고 abandoned로
  primary key (id)
);
alter table public.study_runs enable row level security;
create policy "study_runs: 본인만" on public.study_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.answer_log (
  run_id uuid references public.study_runs(id) on delete cascade, -- 어느 회차의 답인지
  seq integer, -- 회차 안의 답 순번. 기기가 붙임. 같은 번호가 다시 오면 무시(재전송 중복 방지)
  user_id uuid not null references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  item_type text not null, -- word / gram / sent
  item_id text not null, -- 문항 ID(콘텐츠 엑셀의 id)
  answer text not null, -- 고른 답. 문장처럼 답을 보고 스스로 판단하는 문항은 knew / didnt
  correct boolean not null, -- 서버가 채점한 결과
  first_try boolean not null, -- 이 회차에서 이 문항을 처음 푼 것인지
  answered_at timestamptz not null, -- 기기에서 답한 시각
  received_at timestamptz not null default now(), -- 서버가 받은 시각. answered_at과 차이가 크면 연결이 끊긴 동안 답한 것
  primary key (run_id, seq)
);
alter table public.answer_log enable row level security;
create policy "answer_log: 본인만" on public.answer_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.wrong_notes (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  item_type text, -- word / gram / sent
  item_id text, -- 틀린 문항 ID
  lesson_id integer not null, -- 몇 과 문항인지
  wrong_count integer not null default 1, -- 틀린 회차 수. 한 회차에서는 한 번만 셈
  ok_streak integer not null default 0, -- 다른 회차에서 한 번에 맞힌 횟수. 틀리면 0. 2가 되면 이 행을 삭제(졸업)
  last_run_id uuid not null, -- 마지막으로 반영한 회차. 같은 회차면 다시 세지 않음(이어서 하기 중복 방지)
  last_wrong_at timestamptz not null, -- 마지막으로 틀린 시각
  created_at timestamptz not null default now(), -- 처음 오답 노트에 들어간 시각
  primary key (user_id, item_type, item_id)
);
alter table public.wrong_notes enable row level security;
create policy "wrong_notes: 본인만" on public.wrong_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.bookmarks (
  user_id uuid references public.users(id) on delete cascade, -- 어느 사용자의 행인지
  item_type text, -- word / gram / sent / concept(문법 개념 표)
  item_id text, -- 담은 항목 ID(콘텐츠 JSON의 id. 개념 표는 'L03-1'처럼 과-묶음 번호)
  lesson_id integer not null, -- 몇 과 항목인지
  created_at timestamptz not null default now(), -- 책갈피에 담은 시각. 담는 즉시 저장, 다시 누르면 행 삭제
  primary key (user_id, item_type, item_id)
);
alter table public.bookmarks enable row level security;
create policy "bookmarks: 본인만" on public.bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.access_logs (
  id integer, -- 기록 번호
  user_id uuid references public.users(id) on delete cascade, -- 누구의 기록인지. 탈퇴하면 비움
  event text not null, -- login / logout / idle_logout / withdraw / reset(기록 초기화)
  ip_masked text not null, -- 뒤 두 자리를 가린 IP
  client text, -- 브라우저·OS 정도만
  at timestamptz not null default now(), -- 일어난 시각. 3개월 지나면 삭제
  primary key (id)
);
alter table public.access_logs enable row level security;
create policy "access_logs: 본인만" on public.access_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- access_logs는 법령 보관용: 클라이언트 정책을 두지 않고 서버(service role)만 씁니다. 필요하면 위 정책을 지우세요.
-- 탈퇴: auth.users 행을 지우면 on delete cascade로 모든 표의 행이 함께 지워집니다(access_logs 보관 기간 규정은 보안_개인정보_명세.md 참고).
