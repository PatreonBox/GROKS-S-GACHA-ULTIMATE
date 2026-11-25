ALTER TABLE game_discord_flows ADD COLUMN profile_session_hash TEXT;
ALTER TABLE game_discord_sessions ADD COLUMN profile_refresh_attempted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_discord_profiles ADD COLUMN default_avatar_index INTEGER;

CREATE TABLE game_bug_report_cooldowns (
  discord_id TEXT PRIMARY KEY,
  blocked_until INTEGER NOT NULL
);
