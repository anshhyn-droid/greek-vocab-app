-- 사용자 데이터 테이블 (db_user_columns.csv 기준)
-- 시드 스크립트는 콘텐츠 테이블만 다시 만들고, 이 테이블들은 지우지 않습니다.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  google_sub    TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  invite_code   TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

-- 로그인 세션. 브라우저에는 토큰만 두고, 서버에는 토큰의 해시를 저장
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  ui_lang       TEXT NOT NULL DEFAULT 'ko',
  theme_mode    TEXT NOT NULL DEFAULT 'light',
  palette       TEXT NOT NULL DEFAULT 'clay',
  greek_size    TEXT NOT NULL DEFAULT 'm',
  timezone      TEXT NOT NULL DEFAULT 'Asia/Seoul',
  remind_on     INTEGER NOT NULL DEFAULT 1,
  sound_on      INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_goals (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  goal_word  INTEGER NOT NULL DEFAULT 8,
  goal_gram  INTEGER NOT NULL DEFAULT 4,
  goal_sent  INTEGER NOT NULL DEFAULT 8,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  xp_total        INTEGER NOT NULL DEFAULT 0,
  coins           INTEGER NOT NULL DEFAULT 0,
  streak_current  INTEGER NOT NULL DEFAULT 0,
  streak_best     INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  sabbath_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id      TEXT NOT NULL REFERENCES users(id),
  date         TEXT NOT NULL,
  word_done    INTEGER NOT NULL DEFAULT 0,
  gram_done    INTEGER NOT NULL DEFAULT 0,
  sent_done    INTEGER NOT NULL DEFAULT 0,
  xp_earned    INTEGER NOT NULL DEFAULT 0,
  sabbath_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id       TEXT NOT NULL REFERENCES users(id),
  lesson_id     INTEGER NOT NULL,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'not_started',
  completed_at  TEXT,
  last_position INTEGER,
  PRIMARY KEY (user_id, lesson_id, type)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  mode              TEXT NOT NULL,
  lesson_ids        TEXT NOT NULL,
  started_at        TEXT NOT NULL,
  ended_at          TEXT NOT NULL,
  local_date        TEXT NOT NULL,
  item_count        INTEGER NOT NULL,
  first_try_correct INTEGER NOT NULL,
  hint_used         INTEGER NOT NULL DEFAULT 0,
  ox_known          INTEGER,
  ox_unknown        INTEGER,
  xp_earned         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON study_sessions(user_id, ended_at);

CREATE TABLE IF NOT EXISTS wrong_notes (
  user_id        TEXT NOT NULL REFERENCES users(id),
  item_id        TEXT NOT NULL,
  item_type      TEXT NOT NULL,
  wrong_count    INTEGER NOT NULL DEFAULT 1,
  streak_correct INTEGER NOT NULL DEFAULT 0,
  last_wrong_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL REFERENCES users(id),
  item_id    TEXT NOT NULL,
  item_type  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  user_id    TEXT NOT NULL REFERENCES users(id),
  friend_id  TEXT NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  amount        INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  ref_id        TEXT,
  balance_after INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_items (
  user_id     TEXT NOT NULL REFERENCES users(id),
  item_id     TEXT NOT NULL,
  item_type   TEXT NOT NULL,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS weekly_rankings (
  week_start TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  xp         INTEGER NOT NULL DEFAULT 0,
  rank       INTEGER NOT NULL,
  PRIMARY KEY (week_start, user_id)
);
