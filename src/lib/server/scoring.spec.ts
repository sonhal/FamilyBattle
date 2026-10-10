import { describe, expect, it } from 'vitest';
import {
	rankWeek,
	scoreWeek,
	seasonStandings,
	type SeasonPuzzle,
	type SeasonWeek,
	type WeekResult
} from './scoring';

const r = (
	playerId: number,
	groupsSolved: number,
	mistakes: number,
	solveMs: number | null = 60_000
): WeekResult => ({ playerId, groupsSolved, mistakes, solveMs });

describe('rankWeek', () => {
	it('orders by groups solved, then mistakes, then time', () => {
		const ranked = rankWeek([r(1, 3, 4), r(2, 4, 2), r(3, 4, 1, 90_000), r(4, 4, 1, 30_000)]);
		expect(ranked.map((p) => p.playerId)).toEqual([4, 3, 2, 1]);
		expect(ranked.map((p) => p.points)).toEqual([10, 7, 5, 4]);
	});

	it('averages points for ties and skips the next place', () => {
		const ranked = rankWeek([r(1, 4, 0, 1000), r(2, 4, 0, 1000), r(3, 2, 4)]);
		expect(ranked.map((p) => [p.playerId, p.place, p.points])).toEqual([
			[1, 1, 8.5],
			[2, 1, 8.5],
			[3, 3, 5]
		]);
	});

	it('ranks an unfinished attempt below a finished one with the same score', () => {
		const ranked = rankWeek([r(1, 2, 1, null), r(2, 2, 1, 500_000)]);
		expect(ranked.map((p) => p.playerId)).toEqual([2, 1]);
	});

	it('gives every player at least 1 point, even beyond 7th place', () => {
		const ranked = rankWeek(Array.from({ length: 9 }, (_, i) => r(i + 1, 4, 0, (i + 1) * 1000)));
		expect(ranked.at(-1)!.points).toBe(1);
		expect(ranked.at(-1)!.place).toBe(9);
	});
});

const puzzle = (slot: number, results: WeekResult[], voided = false): SeasonPuzzle => ({
	slot,
	voided,
	results
});

describe('scoreWeek', () => {
	it('averages points over the week’s puzzles, counting a missed puzzle as 0', () => {
		const s = scoreWeek([
			puzzle(1, [r(1, 4, 0), r(2, 4, 1)]), // p1 10, p2 7
			puzzle(2, [r(2, 4, 0), r(1, 4, 1)]), // p2 10, p1 7
			puzzle(3, [r(1, 4, 0)]) // p1 10, p2 missed
		]);
		expect(s.map((x) => [x.playerId, x.place, x.points])).toEqual([
			[1, 1, 9],
			[2, 2, 17 / 3]
		]);
		expect(s[1].puzzles.map((p) => p.placement?.points ?? null)).toEqual([7, 10, null]);
	});

	it('leaves voided puzzles out of the average', () => {
		const s = scoreWeek([
			puzzle(1, [r(1, 4, 0), r(2, 4, 1)]),
			puzzle(2, [r(2, 4, 0), r(1, 0, 4)], true),
			puzzle(3, [r(1, 4, 0), r(2, 4, 1)])
		]);
		expect(s.map((x) => [x.playerId, x.points])).toEqual([
			[1, 10],
			[2, 7]
		]);
		expect(s[0].puzzles.map((p) => p.slot)).toEqual([1, 3]);
	});

	it('shares the place on equal averages', () => {
		const s = scoreWeek([
			puzzle(1, [r(1, 4, 0), r(2, 4, 1), r(3, 4, 2)]), // 10, 7, 5
			puzzle(2, [r(2, 4, 0), r(3, 4, 1), r(1, 4, 2)]), // 10, 7, 5
			puzzle(3, [r(3, 4, 0), r(1, 4, 1), r(2, 4, 2)]) // 10, 7, 5
		]);
		expect(s.map((x) => x.place)).toEqual([1, 1, 1]);
	});

	it('equals the puzzle ranking for a single-puzzle week', () => {
		const s = scoreWeek([puzzle(1, [r(1, 4, 0, 1000), r(2, 4, 0, 1000), r(3, 2, 4)])]);
		expect(s.map((x) => [x.playerId, x.place, x.points])).toEqual([
			[1, 1, 8.5],
			[2, 1, 8.5],
			[3, 3, 5]
		]);
	});
});

describe('seasonStandings', () => {
	const week = (n: number, results: WeekResult[], voided = false): SeasonWeek => ({
		week: n,
		puzzles: [puzzle(1, results, voided)]
	});

	it('sums points and scores a missed week as 0', () => {
		const s = seasonStandings([week(1, [r(1, 4, 0), r(2, 3, 0)]), week(2, [r(2, 4, 0)])], 13);
		const p1 = s.find((x) => x.playerId === 1)!;
		const p2 = s.find((x) => x.playerId === 2)!;
		expect(p1.total).toBe(10);
		expect(p1.weeks[1]).toMatchObject({ week: 2, place: null, points: 0, counted: true });
		expect(p2.total).toBe(17);
		expect(s[0].playerId).toBe(2);
	});

	it('excludes voided weeks entirely', () => {
		const s = seasonStandings(
			[week(1, [r(1, 4, 0), r(2, 3, 0)]), week(2, [r(2, 4, 0), r(1, 0, 4)], true)],
			13
		);
		expect(s.find((x) => x.playerId === 1)!.total).toBe(10);
		expect(s.find((x) => x.playerId === 1)!.weeks).toHaveLength(1);
	});

	it('counts every week until a player exceeds the counted target', () => {
		// 3-week season → best 1 week counts. With 1 week revealed nothing is dropped.
		const s = seasonStandings([week(1, [r(1, 4, 0), r(2, 3, 0)])], 3);
		expect(s.map((x) => x.total)).toEqual([10, 7]);
	});

	it('drops the two worst weeks at the end of the season', () => {
		// 4-week season → best 2 count.
		const weeks = [
			week(1, [r(1, 4, 0), r(2, 3, 0)]), // p1 10, p2 7
			week(2, [r(2, 4, 0)]), // p1 missed (0), p2 10
			week(3, [r(2, 4, 0), r(1, 3, 0)]), // p1 7, p2 10
			week(4, [r(1, 4, 0), r(2, 3, 0)]) // p1 10, p2 7
		];
		const s = seasonStandings(weeks, 4);
		const p1 = s.find((x) => x.playerId === 1)!;
		const p2 = s.find((x) => x.playerId === 2)!;
		expect(p1.total).toBe(20); // 10 + 10; the missed week and the 7 are dropped
		expect(p1.weeks.filter((w) => !w.counted).map((w) => w.week)).toEqual([2, 3]);
		expect(p2.total).toBe(20); // 10 + 10
	});

	it('lowers the counted target when weeks are voided', () => {
		// 4 weeks, 1 voided → best 1 counts.
		const weeks = [
			week(1, [r(1, 4, 0), r(2, 3, 0)]),
			week(2, [r(2, 4, 0), r(1, 3, 0)], true),
			week(3, [r(2, 4, 0), r(1, 3, 0)])
		];
		const s = seasonStandings(weeks, 4);
		expect(s.map((x) => [x.playerId, x.total])).toEqual([
			[1, 10],
			[2, 10]
		]);
	});

	it('breaks equal totals by most wins', () => {
		// 13-week season, so every revealed week counts.
		const s = seasonStandings(
			[
				week(1, [r(1, 4, 0), r(4, 4, 1), r(3, 4, 2)]), // p1 10 (win), p4 7, p3 5
				week(2, [r(4, 4, 0), r(5, 4, 1), r(3, 4, 2)]) // p4 10, p5 7, p3 5
			],
			13
		);
		const byId = Object.fromEntries(s.map((x) => [x.playerId, x]));
		expect(byId[1]).toMatchObject({ total: 10, wins: 1 });
		expect(byId[3]).toMatchObject({ total: 10, wins: 0 });
		expect(byId[1].place).toBeLessThan(byId[3].place);
	});

	it('then breaks ties by best single week', () => {
		const s = seasonStandings(
			[
				week(1, [r(9, 4, 0), r(1, 4, 1), r(2, 4, 2)]), // p1 7, p2 5
				week(2, [r(9, 4, 0), r(8, 4, 1), r(2, 4, 2), r(7, 4, 3), r(1, 4, 4)]) // p2 5, p1 3
			],
			13
		);
		const byId = Object.fromEntries(s.map((x) => [x.playerId, x]));
		expect(byId[1]).toMatchObject({ total: 10, wins: 0, bestWeek: 7 });
		expect(byId[2]).toMatchObject({ total: 10, wins: 0, bestWeek: 5 });
		expect(byId[1].place).toBeLessThan(byId[2].place);
	});

	it('uses counted weeks only for wins', () => {
		// 3-week season → best 1 counts.
		const weeks = [
			week(1, [r(1, 4, 0), r(2, 4, 1)]), // p1 10, p2 7
			week(2, [r(2, 4, 0), r(1, 4, 1)]), // p2 10, p1 7
			week(3, [r(1, 4, 0, 1000), r(2, 4, 0, 1000)]) // tie: 8.5 each
		];
		const s = seasonStandings(weeks, 3);
		// Both count one 10-point win; the tie week (a shared win) is dropped for both.
		expect(s.map((x) => [x.total, x.wins])).toEqual([
			[10, 1],
			[10, 1]
		]);
		expect(s[0].place).toBe(s[1].place);
	});

	it('mixes single-puzzle weeks and averaged weeks on the same scale', () => {
		const s = seasonStandings(
			[
				week(1, [r(1, 4, 0), r(2, 4, 1)]), // p1 10, p2 7
				{
					week: 2,
					puzzles: [
						puzzle(1, [r(2, 4, 0), r(1, 4, 1)]), // p2 10, p1 7
						puzzle(2, [r(2, 4, 0), r(1, 4, 1)]), // p2 10, p1 7
						puzzle(3, [r(2, 4, 0)]) // p2 10, p1 missed
					]
				}
			],
			13
		);
		const byId = Object.fromEntries(s.map((x) => [x.playerId, x]));
		expect(byId[1]).toMatchObject({ total: 10 + 14 / 3, wins: 1 });
		expect(byId[2]).toMatchObject({ total: 17, wins: 1 });
	});

	it('voids a week only when all its puzzles are voided', () => {
		const partly: SeasonWeek = {
			week: 1,
			puzzles: [puzzle(1, [r(1, 4, 0)], true), puzzle(2, [r(1, 4, 0)])]
		};
		const fully: SeasonWeek = {
			week: 2,
			puzzles: [puzzle(1, [r(1, 4, 0)], true), puzzle(2, [r(1, 4, 0)], true)]
		};
		const s = seasonStandings([partly, fully], 13);
		expect(s[0].total).toBe(10);
		expect(s[0].weeks.map((w) => w.week)).toEqual([1]);
	});
});
