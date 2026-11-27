UPDATE game_trades
SET expires_at=created_at+4147200000
WHERE status='pending' AND expires_at=created_at+604800000
  AND expires_at>unixepoch('now','subsec')*1000;
