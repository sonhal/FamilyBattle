import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Append-only: never edit a migration that has shipped, add a new one.
const MIGRATIONS: string[] = [
	`
	CREATE TABLE players (
		id           INTEGER PRIMARY KEY,
		auth_user    TEXT NOT NULL UNIQUE,
		display_name TEXT NOT NULL,
		created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);

	CREATE TABLE puzzles (
		id         INTEGER PRIMARY KEY,
		week       INTEGER UNIQUE,
		groups     TEXT NOT NULL,
		status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
		void_note  TEXT,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);

	CREATE TABLE attempts (
		id            INTEGER PRIMARY KEY,
		puzzle_id     INTEGER NOT NULL REFERENCES puzzles(id),
		player_id     INTEGER NOT NULL REFERENCES players(id),
		groups_solved INTEGER NOT NULL DEFAULT 0,
		mistakes      INTEGER NOT NULL DEFAULT 0,
		guesses       TEXT NOT NULL DEFAULT '[]',
		submissions   INTEGER NOT NULL DEFAULT 0,
		started_at    TEXT NOT NULL,
		finished_at   TEXT,
		UNIQUE (puzzle_id, player_id)
	);

	CREATE TABLE puzzle_votes (
		puzzle_id  INTEGER NOT NULL REFERENCES puzzles(id),
		player_id  INTEGER NOT NULL REFERENCES players(id),
		is_bad     INTEGER NOT NULL CHECK (is_bad IN (0, 1)),
		updated_at TEXT NOT NULL,
		PRIMARY KEY (puzzle_id, player_id)
	);
	`
];

export function openDatabase(file: string): Database.Database {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	migrate(db);
	return db;
}

function migrate(db: Database.Database) {
	const version = db.pragma('user_version', { simple: true }) as number;
	for (let i = version; i < MIGRATIONS.length; i++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[i]);
			db.pragma(`user_version = ${i + 1}`);
		})();
	}
}
