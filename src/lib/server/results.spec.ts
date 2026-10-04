import { describe, expect, it } from 'vitest';
import { openDatabase } from './db';
import type { Puzzle } from './puzzle-schema';
import { createRepo } from './repo';
import { liveWeek, seasonWeeksFor, standingsAt, weekResults } from './results';

const season = { start: '2026-10-04', weeks: 13 };

const puzzle: Puzzle = {
	groups: [
		{ category: 'A', color: 'yellow', words: ['a1', 'a2', 'a3', 'a4'] },
		{ category: 'B', color: 'green', words: ['b1', 'b2', 'b3', 'b4'] },
		{ category: 'C', color: 'blue', words: ['c1', 'c2', 'c3', 'c4'] },
		{ category: 'D', color: 'purple', words: ['d1', 'd2', 'd3', 'd4'] }
	]
};

function setup() {
	const repo = createRepo(openDatabase(':memory:'));
	const anna = repo.upsertPlayer('anna', 'Anna');
	const bob = repo.upsertPlayer('bob', 'Bob');
	const lurker = repo.upsertPlayer('lurker', 'Lurker');
	const w1 = repo.insertPuzzle(1, puzzle);
	const w2 = repo.insertPuzzle(2, puzzle);

	const play = (puzzleId: number, playerId: number, solved: number, mistakes: number) => {
		const a = repo.startAttempt(puzzleId, playerId, new Date('2026-10-04T10:00:00Z'));
		repo.saveAttempt(a.id, {
			groupsSolved: solved,
			mistakes,
			guesses: [],
			submissions: solved + mistakes,
			finishedAt: '2026-10-04T10:05:00Z'
		});
	};
	play(w1, anna.id, 4, 0);
	play(w1, bob.id, 4, 2);
	play(w2, bob.id, 4, 0); // week 2 is still open on Oct 12
	return { repo, anna, bob, lurker, w1 };
}

describe('standingsAt', () => {
	it('never includes the open week', () => {
		const { repo, anna, bob } = setup();
		// Mon Oct 12: week 1 closed, week 2 open.
		const s = standingsAt(repo, season, new Date('2026-10-12T10:00:00Z'));
		expect(s.map((x) => [x.playerId, x.total])).toEqual([
			[anna.id, 10],
			[bob.id, 7]
		]);
		expect(s[0].weeks.map((w) => w.week)).toEqual([1]);
	});

	it('includes week 2 once its review starts', () => {
		const { repo, bob } = setup();
		const s = standingsAt(repo, season, new Date('2026-10-15T10:00:00Z'));
		expect(s.find((x) => x.playerId === bob.id)!.total).toBe(17);
	});

	it('drops a voided week from the standings', () => {
		const { repo, w1 } = setup();
		repo.setPuzzleStatus(w1, 'voided', 'two words fit two groups');
		const s = standingsAt(repo, season, new Date('2026-10-12T10:00:00Z'));
		expect(s).toEqual([]);
	});
});

describe('countSeasonPlayers', () => {
	it('counts only players with an attempt up to the given week', () => {
		const { repo } = setup();
		expect(repo.countSeasonPlayers(1)).toBe(2); // the lurker never played
		expect(repo.countSeasonPlayers(2)).toBe(2);
		expect(repo.players()).toHaveLength(3);
	});
});

describe('live results while a week is open', () => {
	// Mon Oct 12: week 1 is closed, week 2 is open.
	const mon = new Date('2026-10-12T10:00:00Z');

	function withCarol() {
		const ctx = setup();
		const carol = ctx.repo.upsertPlayer('carol', 'Carol');
		const w2 = ctx.repo.puzzleForWeek(2)!.id;
		// Carol has started week 2 and solved two groups, but isn't done.
		const a = ctx.repo.startAttempt(w2, carol.id, new Date('2026-10-12T09:00:00Z'));
		ctx.repo.saveAttempt(a.id, {
			groupsSolved: 2,
			mistakes: 0,
			guesses: [],
			submissions: 2,
			finishedAt: null
		});
		return { ...ctx, carol, w2 };
	}

	it('is available only to a player who has finished the open week', () => {
		const { repo, anna, bob, carol, lurker } = withCarol();
		expect(liveWeek(repo, season, mon, bob.id)?.week).toBe(2);
		expect(liveWeek(repo, season, mon, anna.id)).toBeNull(); // not started
		expect(liveWeek(repo, season, mon, carol.id)).toBeNull(); // mid-game
		expect(liveWeek(repo, season, mon, lurker.id)).toBeNull();
	});

	it('is gone once the week is in review', () => {
		const { repo, bob } = withCarol();
		expect(liveWeek(repo, season, new Date('2026-10-15T10:00:00Z'), bob.id)).toBeNull();
	});

	it('ranks finished attempts only', () => {
		const { repo, bob, w2 } = withCarol();
		expect(weekResults(repo, w2, { finishedOnly: true }).map((r) => r.playerId)).toEqual([bob.id]);
		expect(weekResults(repo, w2)).toHaveLength(2);
	});

	it('adds the open week to the standings for a finished viewer only', () => {
		const { repo, anna, bob, carol } = withCarol();

		const forBob = seasonWeeksFor(repo, season, mon, bob.id);
		expect(forBob.liveWeek).toBe(2);
		expect(forBob.weeks.map((w) => w.week)).toEqual([1, 2]);
		// Carol is mid-game, so she is not part of week 2's results.
		expect(forBob.weeks[1].results.map((r) => r.playerId)).toEqual([bob.id]);

		for (const viewer of [anna, carol]) {
			const s = seasonWeeksFor(repo, season, mon, viewer.id);
			expect(s.liveWeek).toBeNull();
			expect(s.weeks.map((w) => w.week)).toEqual([1]);
		}
	});
});
