import { describe, expect, it } from 'vitest';
import { adminOverview, setWeekVoided } from './admin';
import { openDatabase } from './db';
import type { Puzzle } from './puzzle-schema';
import { createRepo } from './repo';
import { standingsAt } from './results';

const season = { start: '2026-10-04', weeks: 13 };
const puzzle: Puzzle = {
	groups: [
		{ category: 'SecretA', color: 'yellow', words: ['a1', 'a2', 'a3', 'a4'] },
		{ category: 'SecretB', color: 'green', words: ['b1', 'b2', 'b3', 'b4'] },
		{ category: 'SecretC', color: 'blue', words: ['c1', 'c2', 'c3', 'c4'] },
		{ category: 'SecretD', color: 'purple', words: ['d1', 'd2', 'd3', 'd4'] }
	]
};
const thursday = new Date('2026-10-08T10:00:00Z'); // week 1 in review, week 2 upcoming
const sunday = new Date('2026-10-04T10:00:00Z'); // week 1 open

function setup() {
	const repo = createRepo(openDatabase(':memory:'));
	const anna = repo.upsertPlayer('anna', 'Anna');
	const bob = repo.upsertPlayer('bob', 'Bob');
	const w1 = repo.insertPuzzle(1, puzzle);
	repo.insertPuzzle(2, puzzle);
	repo.insertPuzzle(null, puzzle);
	for (const p of [anna, bob]) {
		const a = repo.startAttempt(w1, p.id, sunday);
		repo.saveAttempt(a.id, {
			groupsSolved: 4,
			mistakes: p === anna ? 0 : 1,
			guesses: [],
			submissions: 4,
			finishedAt: '2026-10-04T10:05:00Z'
		});
	}
	repo.setVote(w1, anna.id, true, thursday);
	repo.setVote(w1, bob.id, false, thursday);
	return { repo, w1 };
}

describe('adminOverview', () => {
	it('shows counts and vote totals but never puzzle contents', () => {
		const { repo } = setup();
		const o = adminOverview(repo, season, thursday);
		expect(o.weeks).toHaveLength(13);
		expect(o.reserves).toBe(1);
		expect(o.weeks[0]).toMatchObject({
			week: 1,
			phase: 'review',
			hasPuzzle: true,
			status: 'active',
			played: 2,
			votesBad: 1,
			votesFine: 1,
			canVoid: true
		});
		expect(o.weeks[1]).toMatchObject({ week: 2, phase: 'upcoming', canVoid: false });
		expect(o.weeks[2]).toMatchObject({ hasPuzzle: false });
		const json = JSON.stringify(o);
		for (const secret of ['Secret', 'a1', 'd4']) expect(json).not.toContain(secret);
	});
});

describe('setWeekVoided', () => {
	it('voids a reviewed week, removing it from the standings, and restores it', () => {
		const { repo } = setup();
		expect(standingsAt(repo, season, thursday)).toHaveLength(2);

		expect(setWeekVoided(repo, season, thursday, 1, true, ' two words fit two groups ')).toEqual({
			ok: true
		});
		expect(repo.puzzleForWeek(1)).toMatchObject({
			status: 'voided',
			voidNote: 'two words fit two groups'
		});
		expect(standingsAt(repo, season, thursday)).toEqual([]);

		expect(setWeekVoided(repo, season, thursday, 1, false, null)).toEqual({ ok: true });
		expect(repo.puzzleForWeek(1)).toMatchObject({ status: 'active', voidNote: null });
		expect(standingsAt(repo, season, thursday)).toHaveLength(2);
	});

	it('requires a reason when voiding', () => {
		const { repo } = setup();
		expect(setWeekVoided(repo, season, thursday, 1, true, '  ')).toMatchObject({ ok: false });
	});

	it('refuses weeks that are still open or upcoming, or have no puzzle', () => {
		const { repo } = setup();
		expect(setWeekVoided(repo, season, sunday, 1, true, 'x')).toMatchObject({ ok: false });
		expect(setWeekVoided(repo, season, thursday, 2, true, 'x')).toMatchObject({ ok: false });
		expect(setWeekVoided(repo, season, thursday, 3, true, 'x')).toMatchObject({ ok: false });
		expect(setWeekVoided(repo, season, thursday, 99, true, 'x')).toMatchObject({ ok: false });
	});
});
