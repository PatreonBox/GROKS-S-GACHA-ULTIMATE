ALTER TABLE game_profiles ADD COLUMN banned_at INTEGER;

CREATE TABLE game_trades (
  trade_id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES game_profiles(player_id),
  recipient_id TEXT NOT NULL REFERENCES game_profiles(player_id),
  offered TEXT NOT NULL,
  requested TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','declined','cancelled')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution_id TEXT,
  market_eligible INTEGER NOT NULL,
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX game_trades_sender ON game_trades(sender_id, status, created_at DESC);
CREATE INDEX game_trades_recipient ON game_trades(recipient_id, status, created_at DESC);

CREATE TABLE game_trade_items (
  trade_id TEXT NOT NULL REFERENCES game_trades(trade_id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('offered','requested')),
  level_id INTEGER NOT NULL,
  tier INTEGER NOT NULL,
  finish TEXT NOT NULL CHECK (finish IN ('standard','holo','antimatter')),
  sample REAL,
  PRIMARY KEY (trade_id, side, level_id, finish)
);
CREATE INDEX game_trade_items_market ON game_trade_items(level_id, finish, trade_id);

CREATE TABLE game_admin_player_actions (
  admin_id TEXT NOT NULL REFERENCES game_profiles(player_id),
  request_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES game_profiles(player_id),
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (admin_id, request_id)
);
