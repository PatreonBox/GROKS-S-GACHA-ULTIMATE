CREATE TABLE game_profiles (
  player_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL DEFAULT 0,
  wallet TEXT NOT NULL,
  last_request TEXT,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE game_cards (
  player_id TEXT NOT NULL REFERENCES game_profiles(player_id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL,
  card TEXT NOT NULL,
  PRIMARY KEY (player_id, level_id)
);
--> statement-breakpoint
CREATE TABLE game_requests (
  player_id TEXT NOT NULL REFERENCES game_profiles(player_id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, request_id)
);
--> statement-breakpoint
CREATE INDEX game_requests_expiry ON game_requests(player_id, created_at);
--> statement-breakpoint
CREATE TABLE game_scores (
  player_id TEXT PRIMARY KEY REFERENCES game_profiles(player_id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  tier INTEGER NOT NULL,
  survivors INTEGER NOT NULL,
  turns INTEGER NOT NULL,
  score INTEGER NOT NULL,
  posted_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX game_scores_rank ON game_scores(score DESC, turns, posted_at, player_id);
