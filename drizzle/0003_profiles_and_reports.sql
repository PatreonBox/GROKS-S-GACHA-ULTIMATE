CREATE TABLE game_discord_profiles (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_hash TEXT
);

CREATE TABLE game_bug_reports (
  report_id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  retry_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER
);
CREATE INDEX game_bug_reports_user_time ON game_bug_reports(discord_id, created_at);
CREATE INDEX game_bug_reports_outbox ON game_bug_reports(retry_at) WHERE sent_at IS NULL;
