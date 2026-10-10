import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, openDatabase } from './db';
import { createRepo } from './repo';

const groups = JSON.stringify([{ category: 'A', color: 'yellow', words: ['a', 'b', 'c', 'd'] }]);
let dir: string;

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** A database as it looked before puzzles had slots (schema version 1). */
function versionOne(): string {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-db-'));
	const file = path.join(dir, 'league.db');
	const db = new Database(file);
	db.exec(MIGRATIONS[0]);
	db.pragma('user_version = 1');
	db.exec(`
		INSERT INTO players (id, auth_user, display_name) VALUES (1, 'anna', 'Anna');
		INSERT INTO puzzles (id, week, groups, status, void_note) VALUES
			(10, 1, '${groups}', 'active', NULL),
			(11, 2, '${groups}', 'voided', 'two fits'),
			(12, NULL, '${groups}', 'active', NULL);
		INSERT INTO attempts (puzzle_id, player_id, started_at) VALUES (10, 1, '2026-10-04T10:00:00Z');
		INSERT INTO puzzle_votes (puzzle_id, player_id, is_bad, updated_at)
			VALUES (10, 1, 1, '2026-10-08T10:00:00Z');
	`);
	db.close();
	return file;
}

describe('migrations', () => {
	it('turns weekly puzzles into slot 1 and keeps ids, attempts and votes', () => {
		const repo = createRepo(openDatabase(versionOne()));
		expect(repo.allPuzzles().map((p) => [p.id, p.week, p.slot, p.status, p.voidNote])).toEqual([
			[10, 1, 1, 'active', null],
			[11, 2, 1, 'voided', 'two fits'],
			[12, null, null, 'active', null]
		]);
		expect(repo.attempt(10, 1)).toMatchObject({ puzzleId: 10, playerId: 1 });
		expect(repo.vote(10, 1)).toBe(true);
	});

	it('allows three puzzles per week, one per slot, and still enforces foreign keys', () => {
		const repo = createRepo(openDatabase(versionOne()));
		const p = { groups: JSON.parse(groups) };
		repo.insertPuzzle(p, { week: 3, slot: 1 });
		repo.insertPuzzle(p, { week: 3, slot: 2 });
		repo.insertPuzzle(p);
		expect(repo.puzzlesForWeek(3).map((x) => x.slot)).toEqual([1, 2]);
		expect(() => repo.insertPuzzle(p, { week: 3, slot: 2 })).toThrow(/UNIQUE/);
		expect(() => repo.startAttempt(999, 1, new Date())).toThrow(/FOREIGN KEY/);
	});
});
