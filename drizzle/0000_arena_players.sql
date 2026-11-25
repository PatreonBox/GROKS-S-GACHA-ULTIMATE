CREATE TABLE player_identities (
 provider TEXT NOT NULL,
 subject TEXT NOT NULL,
 player_id TEXT NOT NULL,
 PRIMARY KEY(provider, subject)
);
--> statement-breakpoint
CREATE TABLE arena_scores (
 player_id TEXT PRIMARY KEY NOT NULL,
 alias TEXT NOT NULL,
 tier INTEGER NOT NULL,
 survivors INTEGER NOT NULL,
 turns INTEGER NOT NULL,
 score INTEGER NOT NULL,
 posted_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX arena_order ON arena_scores(score DESC, posted_at, player_id);
