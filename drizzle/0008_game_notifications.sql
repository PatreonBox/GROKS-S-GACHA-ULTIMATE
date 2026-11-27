ALTER TABLE game_discord_flows ADD COLUMN membership_check INTEGER NOT NULL DEFAULT 0;

CREATE TABLE game_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES game_profiles(player_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('trade-request', 'trade-accepted', 'trade-declined', 'discord-key-bonus')),
  trade_id TEXT REFERENCES game_trades(trade_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX game_notifications_player ON game_notifications(player_id, id DESC);
CREATE INDEX game_notifications_unread ON game_notifications(player_id, id DESC) WHERE read_at IS NULL;

CREATE TABLE game_discord_key_bonus (
  discord_id TEXT PRIMARY KEY,
  verified_at INTEGER NOT NULL,
  redeemed_at INTEGER
);

CREATE TRIGGER notify_game_trade_request AFTER INSERT ON game_trades
WHEN NEW.status = 'pending'
BEGIN
  INSERT INTO game_notifications(player_id, kind, trade_id, created_at)
  VALUES(NEW.recipient_id, 'trade-request', NEW.trade_id, NEW.created_at);
END;

CREATE TRIGGER notify_game_trade_reply AFTER UPDATE OF status ON game_trades
WHEN OLD.status = 'pending' AND NEW.status IN ('completed', 'declined')
BEGIN
  INSERT INTO game_notifications(player_id, kind, trade_id, created_at)
  VALUES(NEW.sender_id, CASE NEW.status WHEN 'completed' THEN 'trade-accepted' ELSE 'trade-declined' END,
    NEW.trade_id, NEW.resolved_at);
END;

CREATE TRIGGER notify_game_discord_bonus AFTER UPDATE OF redeemed_at ON game_discord_key_bonus
WHEN OLD.redeemed_at IS NULL AND NEW.redeemed_at IS NOT NULL
BEGIN
  INSERT INTO game_notifications(player_id, kind, created_at)
  SELECT player_id, 'discord-key-bonus', NEW.redeemed_at FROM game_profiles WHERE owner = 'discord:' || NEW.discord_id;
END;
