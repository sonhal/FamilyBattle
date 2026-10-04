import type Database from 'better-sqlite3';
import type { AttemptState, GuessRecord } from './game';
import type { Group, Puzzle } from './puzzle-schema';

// All SQL lives here. Rows are converted to plain objects at this boundary.

export interface Player {
	id: number;
	authUser: string;
	displayName: string;
}

export interface PuzzleRow {
	id: number;
	week: number | null;
	groups: Group[];
	status: 'active' | 'voided';
	voidNote: string | null;
}

export interface Attempt extends AttemptState {
	id: number;
	puzzleId: number;
	playerId: number;
	startedAt: string;
}

interface RawPuzzle {
	id: number;
	week: number | null;
	groups: string;
	status: 'active' | 'voided';
	void_note: string | null;
}

interface RawAttempt {
	id: number;
	puzzle_id: number;
	player_id: number;
	groups_solved: number;
	mistakes: number;
	guesses: string;
	submissions: number;
	started_at: string;
	finished_at: string | null;
}

const toPuzzle = (r: RawPuzzle): PuzzleRow => ({
	id: r.id,
	week: r.week,
	groups: JSON.parse(r.groups) as Group[],
	status: r.status,
	voidNote: r.void_note
});

const toAttempt = (r: RawAttempt): Attempt => ({
	id: r.id,
	puzzleId: r.puzzle_id,
	playerId: r.player_id,
	groupsSolved: r.groups_solved,
	mistakes: r.mistakes,
	guesses: JSON.parse(r.guesses) as GuessRecord[],
	submissions: r.submissions,
	startedAt: r.started_at,
	finishedAt: r.finished_at
});

export function createRepo(db: Database.Database) {
	return {
		db,

		upsertPlayer(authUser: string, displayName: string): Player {
			const row = db
				.prepare(
					`INSERT INTO players (auth_user, display_name) VALUES (?, ?)
					 ON CONFLICT (auth_user) DO UPDATE SET display_name = excluded.display_name
					 RETURNING id, auth_user, display_name`
				)
				.get(authUser, displayName) as { id: number; auth_user: string; display_name: string };
			return { id: row.id, authUser: row.auth_user, displayName: row.display_name };
		},

		players(): Player[] {
			return (
				db.prepare('SELECT id, auth_user, display_name FROM players ORDER BY id').all() as {
					id: number;
					auth_user: string;
					display_name: string;
				}[]
			).map((r) => ({ id: r.id, authUser: r.auth_user, displayName: r.display_name }));
		},

		puzzleForWeek(week: number): PuzzleRow | null {
			const r = db.prepare('SELECT * FROM puzzles WHERE week = ?').get(week) as
				RawPuzzle | undefined;
			return r ? toPuzzle(r) : null;
		},

		allPuzzles(): PuzzleRow[] {
			return (
				db.prepare('SELECT * FROM puzzles ORDER BY week IS NULL, week, id').all() as RawPuzzle[]
			).map(toPuzzle);
		},

		insertPuzzle(week: number | null, puzzle: Puzzle): number {
			const r = db
				.prepare('INSERT INTO puzzles (week, groups) VALUES (?, ?) RETURNING id')
				.get(week, JSON.stringify(puzzle.groups)) as { id: number };
			return r.id;
		},

		deletePuzzle(id: number) {
			db.prepare('DELETE FROM puzzles WHERE id = ?').run(id);
		},

		setPuzzleStatus(id: number, status: 'active' | 'voided', note: string | null) {
			db.prepare('UPDATE puzzles SET status = ?, void_note = ? WHERE id = ?').run(status, note, id);
		},

		attempt(puzzleId: number, playerId: number): Attempt | null {
			const r = db
				.prepare('SELECT * FROM attempts WHERE puzzle_id = ? AND player_id = ?')
				.get(puzzleId, playerId) as RawAttempt | undefined;
			return r ? toAttempt(r) : null;
		},

		/** Idempotent: a second start keeps the original started_at. */
		startAttempt(puzzleId: number, playerId: number, now: Date): Attempt {
			db.prepare(
				`INSERT INTO attempts (puzzle_id, player_id, started_at) VALUES (?, ?, ?)
				 ON CONFLICT (puzzle_id, player_id) DO NOTHING`
			).run(puzzleId, playerId, now.toISOString());
			return this.attempt(puzzleId, playerId)!;
		},

		saveAttempt(id: number, s: AttemptState) {
			db.prepare(
				`UPDATE attempts
				 SET groups_solved = ?, mistakes = ?, guesses = ?, submissions = ?, finished_at = ?
				 WHERE id = ?`
			).run(s.groupsSolved, s.mistakes, JSON.stringify(s.guesses), s.submissions, s.finishedAt, id);
		},

		bumpSubmissions(id: number) {
			db.prepare('UPDATE attempts SET submissions = submissions + 1 WHERE id = ?').run(id);
		},

		attemptsForPuzzle(puzzleId: number): Attempt[] {
			return (
				db.prepare('SELECT * FROM attempts WHERE puzzle_id = ?').all(puzzleId) as RawAttempt[]
			).map(toAttempt);
		},

		allAttempts(): Attempt[] {
			return (db.prepare('SELECT * FROM attempts').all() as RawAttempt[]).map(toAttempt);
		},

		countAttempts(puzzleId: number): number {
			return (
				db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE puzzle_id = ?').get(puzzleId) as {
					n: number;
				}
			).n;
		},

		/** Distinct players with an attempt on any puzzle up to and including `week`. */
		countSeasonPlayers(week: number): number {
			return (
				db
					.prepare(
						`SELECT COUNT(DISTINCT a.player_id) AS n
						 FROM attempts a JOIN puzzles p ON p.id = a.puzzle_id
						 WHERE p.week IS NOT NULL AND p.week <= ?`
					)
					.get(week) as { n: number }
			).n;
		},

		vote(puzzleId: number, playerId: number): boolean | null {
			const r = db
				.prepare('SELECT is_bad FROM puzzle_votes WHERE puzzle_id = ? AND player_id = ?')
				.get(puzzleId, playerId) as { is_bad: number } | undefined;
			return r ? r.is_bad === 1 : null;
		},

		setVote(puzzleId: number, playerId: number, isBad: boolean, now: Date) {
			db.prepare(
				`INSERT INTO puzzle_votes (puzzle_id, player_id, is_bad, updated_at) VALUES (?, ?, ?, ?)
				 ON CONFLICT (puzzle_id, player_id) DO UPDATE
				 SET is_bad = excluded.is_bad, updated_at = excluded.updated_at`
			).run(puzzleId, playerId, isBad ? 1 : 0, now.toISOString());
		},

		voteTotals(puzzleId: number): { bad: number; fine: number } {
			const r = db
				.prepare(
					`SELECT COALESCE(SUM(is_bad), 0) AS bad, COALESCE(SUM(1 - is_bad), 0) AS fine
					 FROM puzzle_votes WHERE puzzle_id = ?`
				)
				.get(puzzleId) as { bad: number; fine: number };
			return r;
		}
	};
}

export type Repo = ReturnType<typeof createRepo>;
