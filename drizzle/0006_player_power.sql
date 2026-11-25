ALTER TABLE game_profiles ADD COLUMN collection_power INTEGER;
ALTER TABLE game_profiles ADD COLUMN power_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_profiles ADD COLUMN ranking_xp INTEGER NOT NULL DEFAULT 0;
CREATE INDEX game_profiles_power_order ON game_profiles(leaderboard_excluded, collection_power DESC, ranking_xp DESC, player_id);
