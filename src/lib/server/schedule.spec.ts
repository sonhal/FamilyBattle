import { describe, expect, it } from 'vitest';
import {
	currentWeek,
	dropsAt,
	isPlayable,
	opensAt,
	phaseOf,
	puzzleCount,
	revealedWeeks,
	reviewEndsAt,
	reviewStartsAt
} from './schedule';

// Weeks 1–2 have one puzzle (Sun–Wed); from week 3, three (Mon/Wed/Fri until Sunday).
const season = { start: '2026-10-04', weeks: 13, singleWeeks: 2 };
const utc = (t: { toUTC(): { toISO(): string | null } }) => t.toUTC().toISO();

describe('schedule', () => {
	it('opens week 1 on Sunday Oct 4 at 00:00 Oslo (22:00 UTC the day before)', () => {
		expect(utc(opensAt(season, 1))).toBe('2026-10-03T22:00:00.000Z');
	});

	it('gives single-puzzle weeks one puzzle and later weeks three', () => {
		expect([1, 2, 3, 12, 13].map((w) => puzzleCount(season, w))).toEqual([1, 1, 3, 3, 3]);
	});

	it('extends week 2 review to Monday, when week 3 opens', () => {
		expect(utc(reviewStartsAt(season, 2))).toBe('2026-10-14T22:00:00.000Z'); // Thu Oct 15
		expect(utc(reviewEndsAt(season, 2))).toBe('2026-10-18T22:00:00.000Z'); // Mon Oct 19
		expect(utc(opensAt(season, 3))).toBe('2026-10-18T22:00:00.000Z');
	});

	it('drops week 3 on Mon/Wed/Fri and closes it at Monday 00:00 across the DST change', () => {
		expect([1, 2, 3].map((s) => utc(dropsAt(season, 3, s)))).toEqual([
			'2026-10-18T22:00:00.000Z', // Mon Oct 19
			'2026-10-20T22:00:00.000Z', // Wed Oct 21
			'2026-10-22T22:00:00.000Z' // Fri Oct 23
		]);
		// Clocks go back Sun Oct 25 at 03:00, so Mon Oct 26 00:00 is 23:00 UTC.
		expect(utc(reviewStartsAt(season, 3))).toBe('2026-10-25T23:00:00.000Z');
		expect(utc(reviewEndsAt(season, 3))).toBe('2026-11-01T23:00:00.000Z');
	});

	it('compresses the final week so the winner is known on New Year’s Eve afternoon', () => {
		expect([1, 2, 3].map((s) => utc(dropsAt(season, 13, s)))).toEqual([
			'2026-12-27T23:00:00.000Z', // Mon Dec 28
			'2026-12-28T23:00:00.000Z', // Tue Dec 29
			'2026-12-29T23:00:00.000Z' // Wed Dec 30
		]);
		expect(utc(reviewStartsAt(season, 13))).toBe('2026-12-31T15:00:00.000Z'); // Thu 16:00
	});

	it('computes phases at the boundaries', () => {
		expect(phaseOf(season, 1, new Date('2026-10-03T21:59:59Z'))).toBe('upcoming');
		expect(phaseOf(season, 1, new Date('2026-10-03T22:00:00Z'))).toBe('open');
		// Wed 23:59:59 Oslo
		expect(phaseOf(season, 1, new Date('2026-10-07T21:59:59Z'))).toBe('open');
		// Thu 00:00 Oslo
		expect(phaseOf(season, 1, new Date('2026-10-07T22:00:00Z'))).toBe('review');
		expect(phaseOf(season, 1, new Date('2026-10-10T21:59:59Z'))).toBe('review');
		expect(phaseOf(season, 1, new Date('2026-10-10T22:00:00Z'))).toBe('closed');
		// Week 3 is still open on Sunday evening and revealed on Monday.
		expect(phaseOf(season, 3, new Date('2026-10-25T22:59:59Z'))).toBe('open');
		expect(phaseOf(season, 3, new Date('2026-10-25T23:00:00Z'))).toBe('review');
	});

	it('makes each puzzle playable from its drop until the week closes', () => {
		const tue = new Date('2026-10-20T12:00:00Z');
		const wed = new Date('2026-10-21T12:00:00Z');
		const nextMon = new Date('2026-10-26T12:00:00Z');
		expect(isPlayable(season, 3, 1, tue)).toBe(true);
		expect(isPlayable(season, 3, 2, tue)).toBe(false);
		expect(isPlayable(season, 3, 2, wed)).toBe(true);
		expect(isPlayable(season, 3, 3, wed)).toBe(false);
		expect(isPlayable(season, 3, 1, nextMon)).toBe(false);
		expect(isPlayable(season, 3, 4, wed)).toBe(false);
		expect(isPlayable(season, 2, 2, new Date('2026-10-12T12:00:00Z'))).toBe(false);
	});

	it('finds the current week, preferring the open week over one in review', () => {
		expect(currentWeek(season, new Date('2026-10-03T12:00:00Z'))).toBeNull();
		expect(currentWeek(season, new Date('2026-10-04T12:00:00Z'))).toBe(1);
		expect(currentWeek(season, new Date('2026-10-09T12:00:00Z'))).toBe(1);
		expect(currentWeek(season, new Date('2026-10-11T12:00:00Z'))).toBe(2);
		expect(currentWeek(season, new Date('2026-10-18T12:00:00Z'))).toBe(2); // Sun: week 2 review
		expect(currentWeek(season, new Date('2026-10-19T12:00:00Z'))).toBe(3);
		// Week 3 is in review while week 4 is open.
		expect(currentWeek(season, new Date('2026-10-27T12:00:00Z'))).toBe(4);
		expect(currentWeek(season, new Date('2026-12-31T14:59:59Z'))).toBe(13);
		expect(phaseOf(season, 13, new Date('2026-12-31T15:00:00Z'))).toBe('review');
		expect(currentWeek(season, new Date('2027-01-07T12:00:00Z'))).toBe(13);
		expect(currentWeek(season, new Date('2027-01-08T12:00:00Z'))).toBeNull();
	});

	it('reveals only weeks past their open phase', () => {
		expect(revealedWeeks(season, new Date('2026-10-05T12:00:00Z'))).toEqual([]);
		expect(revealedWeeks(season, new Date('2026-10-08T12:00:00Z'))).toEqual([1]);
		expect(revealedWeeks(season, new Date('2026-10-12T12:00:00Z'))).toEqual([1]);
		expect(revealedWeeks(season, new Date('2026-10-15T12:00:00Z'))).toEqual([1, 2]);
		expect(revealedWeeks(season, new Date('2026-10-25T12:00:00Z'))).toEqual([1, 2]);
		expect(revealedWeeks(season, new Date('2026-10-26T12:00:00Z'))).toEqual([1, 2, 3]);
	});

	it('starts a season without single-puzzle weeks on its own Monday', () => {
		const next = { start: '2027-10-04', weeks: 13 }; // a Monday
		expect(puzzleCount(next, 1)).toBe(3);
		expect([1, 2, 3].map((s) => dropsAt(next, 1, s).toISODate())).toEqual([
			'2027-10-04',
			'2027-10-06',
			'2027-10-08'
		]);
		expect(reviewStartsAt(next, 1).toISODate()).toBe('2027-10-11');
	});
});
