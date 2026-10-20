-- 성경 헬라어 학습 앱 · 사용자 DB (Turso / SQLite)
-- db/schema.sql(Supabase/PostgreSQL)과 같은 표·열. 바꾼 점:
--   uuid·timestamptz·date·jsonb → TEXT(시각은 ISO 문자열, jsonb는 JSON 문자열), boolean → INTEGER(0/1), bigint → INTEGER
--   auth.users 대신 users가 사용자 원본. Supabase의 행 보안(RLS) 대신 서버 API가 세션의 user_id로만 조회·수정
--   탈퇴: users 행을 지우면 ON DELETE CASCADE로 모든 표의 행이 함께 지워짐(access_logs는 user_id만 비움)
-- 서버(server/db.ts)가 시작할 때 이 파일을 실행합니다. 모두 IF NOT EXISTS라 여러 번 실행해도 됩니다.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,               -- 사용자 고유 번호(UUID)
  google_sub    TEXT NOT NULL UNIQUE,           -- Google 로그인 고유 ID. 다시 로그인하면 이 값으로 기존 계정을 찾음
  email         TEXT NOT NULL,                  -- Google 계정 이메일. 화면에는 앞 두 글자만 표시
  display_name  TEXT NOT NULL,                  -- 앱에 보이는 이름. Google 계정 이름을 그대로 씀
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_consents (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,                      -- age / terms / privacy. 모두 필수
  version   TEXT NOT NULL,                      -- 동의한 약관 버전. 바뀌면 다음 로그인 때 다시 받음
  agreed    INTEGER NOT NULL,
  agreed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, type, version)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id                  TEXT PRIMARY KEY,         -- 세션 쿠키 값의 해시. 쿠키 원문은 저장하지 않음
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), -- 마지막 요청 시각
  idle_expires_at     TEXT NOT NULL,            -- 이 시각이 지나면 자동 로그아웃
  absolute_expires_at TEXT NOT NULL,            -- 계속 사용해도 이 시각이 지나면 다시 로그인
  ended_at            TEXT,
  end_reason          TEXT                      -- logout / idle / absolute / withdraw
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  font_size  TEXT NOT NULL DEFAULT 'm',         -- m / l / xl
  timezone   TEXT NOT NULL DEFAULT 'Asia/Seoul',-- '오늘'의 기준 시간대
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_goals (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal_word  INTEGER NOT NULL DEFAULT 8,
  goal_gram  INTEGER NOT NULL DEFAULT 4,
  goal_sent  INTEGER NOT NULL DEFAULT 8,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp_total        INTEGER NOT NULL DEFAULT 0,   -- 누적 경험치. 서버가 계산해 더함
  streak_current  INTEGER NOT NULL DEFAULT 0,
  streak_best     INTEGER NOT NULL DEFAULT 0,
  study_days      INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT                          -- YYYY-MM-DD (사용자 시간대)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,                     -- 사용자 시간대 기준 날짜 YYYY-MM-DD
  word_done  INTEGER NOT NULL DEFAULT 0,
  gram_done  INTEGER NOT NULL DEFAULT 0,
  sent_done  INTEGER NOT NULL DEFAULT 0,
  test_items INTEGER NOT NULL DEFAULT 0,
  xp_earned  INTEGER NOT NULL DEFAULT 0,
  study_ms   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id       INTEGER NOT NULL,             -- 몇 과(1~26)
  type            TEXT NOT NULL,                -- word / gram / sent
  status          TEXT NOT NULL,                -- not_started / in_progress / done
  completed_at    TEXT,
  completed_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id, type)
);

CREATE TABLE IF NOT EXISTS study_runs (
  id                TEXT PRIMARY KEY,           -- 회차 ID(UUID). 이어서 하면 같은 ID
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL,              -- study / test
  type              TEXT NOT NULL,              -- 학습: word/gram/sent, 테스트: mix/flash
  lesson_ids        TEXT NOT NULL,              -- 쉼표로 구분
  test_options      TEXT,                       -- JSON
  content_version   TEXT NOT NULL,
  status            TEXT NOT NULL,              -- in_progress / done / abandoned
  queue             TEXT NOT NULL,              -- JSON: 남은 문항 ID 순서
  item_total        INTEGER NOT NULL,
  passed_count      INTEGER NOT NULL DEFAULT 0,
  first_try_correct INTEGER NOT NULL DEFAULT 0,
  extra_state       TEXT,                       -- JSON
  elapsed_ms        INTEGER NOT NULL DEFAULT 0,
  rev               INTEGER NOT NULL DEFAULT 0, -- 저장할 때마다 +1 (오래된 저장이 덮어쓰지 못하게)
  xp_earned         INTEGER NOT NULL DEFAULT 0,
  started_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ended_at          TEXT,
  expires_at        TEXT                        -- 학습만. 지나면 abandoned
);
CREATE INDEX IF NOT EXISTS idx_study_runs_user ON study_runs(user_id, status);

CREATE TABLE IF NOT EXISTS answer_log (
  run_id      TEXT NOT NULL REFERENCES study_runs(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,                 -- 회차 안의 답 순번(같은 번호는 무시)
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  answer      TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  first_try   INTEGER NOT NULL,
  answered_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (run_id, seq)
);

CREATE TABLE IF NOT EXISTS wrong_notes (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type     TEXT NOT NULL,                  -- word / gram / sent
  item_id       TEXT NOT NULL,
  lesson_id     INTEGER NOT NULL,
  wrong_count   INTEGER NOT NULL DEFAULT 1,     -- 틀린 회차 수(한 회차에서 한 번만)
  ok_streak     INTEGER NOT NULL DEFAULT 0,     -- 다른 회차에서 한 번에 맞힌 횟수. 2가 되면 삭제(졸업)
  last_run_id   TEXT NOT NULL,
  last_wrong_at TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL,                     -- word / gram / sent / concept
  item_id    TEXT NOT NULL,                     -- 개념 표는 'L03-1'
  lesson_id  INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS access_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT REFERENCES users(id) ON DELETE SET NULL, -- 탈퇴하면 비움
  event     TEXT NOT NULL,                      -- login / logout / idle_logout / withdraw / reset
  ip_masked TEXT NOT NULL,                      -- 뒤 두 자리를 가린 IP
  client    TEXT,                               -- 브라우저·OS 정도만
  at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) -- 3개월 지나면 삭제
);
CREATE INDEX IF NOT EXISTS idx_access_logs_at ON access_logs(at);
