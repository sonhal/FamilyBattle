import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Append-only: never edit a migration that has shipped, add a new one.
export const MIGRATIONS: string[] = [
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
	`,
	// Up to three puzzles per week, numbered by slot. SQLite can't drop the
	// UNIQUE on week, so the table is rebuilt; weekly puzzles become slot 1.
	`
	CREATE TABLE puzzles_new (
		id         INTEGER PRIMARY KEY,
		week       INTEGER,
		slot       INTEGER CHECK (slot >= 1),
		groups     TEXT NOT NULL,
		status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
		void_note  TEXT,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		UNIQUE (week, slot),
		CHECK ((week IS NULL) = (slot IS NULL))
	);

	INSERT INTO puzzles_new (id, week, slot, groups, status, void_note, created_at)
	SELECT id, week, CASE WHEN week IS NULL THEN NULL ELSE 1 END, groups, status, void_note, created_at
	FROM puzzles;

	DROP TABLE puzzles;
	ALTER TABLE puzzles_new RENAME TO puzzles;
	`
];

export function openDatabase(file: string): Database.Database {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('busy_timeout = 5000');
	// Table rebuilds drop a referenced table, so foreign keys are enforced only
	// after migrating. The pragma is a no-op inside a transaction.
	db.pragma('foreign_keys = OFF');
	migrate(db);
	db.pragma('foreign_keys = ON');
	return db;
}

function migrate(db: Database.Database) {
	const version = db.pragma('user_version', { simple: true }) as number;
	for (let i = version; i < MIGRATIONS.length; i++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[i]);
			const broken = db.pragma('foreign_key_check') as unknown[];
			if (broken.length)
				throw new Error(`migration ${i + 1} broke ${broken.length} foreign key(s)`);
			db.pragma(`user_version = ${i + 1}`);
		})();
	}
}
