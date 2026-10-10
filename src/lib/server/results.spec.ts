import { describe, expect, it } from 'vitest';
import { openDatabase } from './db';
import type { Puzzle } from './puzzle-schema';
import { createRepo } from './repo';
import { liveWeek, livePuzzle, puzzleResults, seasonWeeksFor, standingsAt } from './results';

const season = { start: '2026-10-04', weeks: 13, singleWeeks: 2 };

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
	const w1 = repo.insertPuzzle(puzzle, { week: 1, slot: 1 });
	const w2 = repo.insertPuzzle(puzzle, { week: 2, slot: 1 });

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

describe('countPlayers', () => {
	it('counts every player, including those who have not started yet', () => {
		const { repo, w1 } = setup();
		expect(repo.countAttempts(w1)).toBe(2);
		expect(repo.countPlayers()).toBe(3); // the lurker counts too
	});
});

describe('live results while a week is open', () => {
	// Mon Oct 12: week 1 is closed, week 2 is open.
	const mon = new Date('2026-10-12T10:00:00Z');

	function withCarol() {
		const ctx = setup();
		const carol = ctx.repo.upsertPlayer('carol', 'Carol');
		const w2 = ctx.repo.puzzle(2, 1)!.id;
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
		expect(puzzleResults(repo, w2, { finishedOnly: true }).map((r) => r.playerId)).toEqual([
			bob.id
		]);
		expect(puzzleResults(repo, w2)).toHaveLength(2);
	});

	it('adds the open week to the standings for a finished viewer only', () => {
		const { repo, anna, bob, carol } = withCarol();

		const forBob = seasonWeeksFor(repo, season, mon, bob.id);
		expect(forBob.liveWeek).toBe(2);
		expect(forBob.weeks.map((w) => w.week)).toEqual([1, 2]);
		// Carol is mid-game, so she is not part of week 2's results.
		expect(forBob.weeks[1].puzzles[0].results.map((r) => r.playerId)).toEqual([bob.id]);

		for (const viewer of [anna, carol]) {
			const s = seasonWeeksFor(repo, season, mon, viewer.id);
			expect(s.liveWeek).toBeNull();
			expect(s.weeks.map((w) => w.week)).toEqual([1]);
		}
	});
});

describe('three-puzzle weeks', () => {
	const at = (iso: string) => new Date(iso);
	// Week 3: Mon Oct 19, Wed Oct 21, Fri Oct 23; closes Mon Oct 26 00:00.
	const thu = at('2026-10-22T10:00:00Z');

	function week3() {
		const repo = createRepo(openDatabase(':memory:'));
		const anna = repo.upsertPlayer('anna', 'Anna');
		const bob = repo.upsertPlayer('bob', 'Bob');
		const ids = [1, 2, 3].map((slot) => repo.insertPuzzle(puzzle, { week: 3, slot }));
		const play = (puzzleId: number, playerId: number, mistakes: number, finished = true) => {
			const a = repo.startAttempt(puzzleId, playerId, at('2026-10-19T10:00:00Z'));
			repo.saveAttempt(a.id, {
				groupsSolved: finished ? 4 : 2,
				mistakes,
				guesses: [],
				submissions: 4 + mistakes,
				finishedAt: finished ? '2026-10-19T10:05:00Z' : null
			});
		};
		return { repo, anna, bob, ids, play };
	}

	it('goes live per puzzle, for the puzzles the viewer has finished', () => {
		const { repo, anna, bob, ids, play } = week3();
		play(ids[0], anna.id, 0);
		play(ids[1], bob.id, 0);
		expect(liveWeek(repo, season, thu, anna.id)).toMatchObject({ week: 3, finished: [1] });
		expect(livePuzzle(repo, season, thu, anna.id, 3, 1)?.id).toBe(ids[0]);
		expect(livePuzzle(repo, season, thu, anna.id, 3, 2)).toBeNull();
		expect(livePuzzle(repo, season, thu, bob.id, 3, 2)?.id).toBe(ids[1]);
	});

	it('hides puzzles the viewer has not finished from the provisional standings', () => {
		const { repo, anna, bob, ids, play } = week3();
		play(ids[0], anna.id, 0);
		play(ids[0], bob.id, 1);
		play(ids[1], bob.id, 0);
		const { weeks, liveWeek: live } = seasonWeeksFor(repo, season, thu, anna.id);
		expect(live).toBe(3);
		const w3 = weeks.find((w) => w.week === 3)!;
		expect(w3.puzzles.map((p) => p.results.length)).toEqual([2, 0, 0]);
	});

	it('scores the revealed week as the average of its three puzzles', () => {
		const { repo, anna, bob, ids, play } = week3();
		play(ids[0], anna.id, 0); // anna 10, bob 7
		play(ids[0], bob.id, 1);
		play(ids[1], bob.id, 0); // bob 10, anna missed
		play(ids[2], anna.id, 0); // anna 10, bob unfinished 7
		play(ids[2], bob.id, 0, false);
		const s = standingsAt(repo, season, at('2026-10-26T10:00:00Z'));
		expect(s.map((x) => [x.playerId, x.total])).toEqual([
			[bob.id, 8],
			[anna.id, 20 / 3]
		]);
	});
});
