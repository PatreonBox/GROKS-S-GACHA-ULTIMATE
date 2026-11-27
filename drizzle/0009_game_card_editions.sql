CREATE TABLE game_card_editions (
  level_id INTEGER NOT NULL,
  finish TEXT NOT NULL CHECK (finish IN ('standard','holo','antimatter')),
  last_number INTEGER NOT NULL CHECK (last_number > 0),
  PRIMARY KEY (level_id, finish)
);
