CREATE TABLE game_discord_flows (
  token_hash TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE game_discord_sessions (
  token_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
