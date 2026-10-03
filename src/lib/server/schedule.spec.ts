import { describe, expect, it } from 'vitest';
import { closesAt, currentWeek, opensAt, phaseOf, revealedWeeks, reviewStartsAt } from './schedule';

const season = { start: '2026-10-04', weeks: 13 };

describe('schedule', () => {
	it('opens week 1 on Sunday Oct 4 at 00:00 Oslo (22:00 UTC the day before)', () => {
		expect(opensAt(season, 1).toUTC().toISO()).toBe('2026-10-03T22:00:00.000Z');
	});

	it('opens week 13 on Dec 27 at 00:00 Oslo winter time (23:00 UTC)', () => {
		expect(opensAt(season, 13).toUTC().toISO()).toBe('2026-12-26T23:00:00.000Z');
	});

	it('keeps 00:00 boundaries across the Oct 25 DST change', () => {
		// Week 4 opens Oct 25, the day clocks go back at 03:00.
		expect(opensAt(season, 4).toUTC().toISO()).toBe('2026-10-24T22:00:00.000Z');
		// Its review starts Thursday Oct 29 00:00 winter time.
		expect(reviewStartsAt(season, 4).toUTC().toISO()).toBe('2026-10-28T23:00:00.000Z');
		expect(closesAt(season, 4).toUTC().toISO()).toBe('2026-10-31T23:00:00.000Z');
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
	});

	it('finds the current week', () => {
		expect(currentWeek(season, new Date('2026-10-03T12:00:00Z'))).toBeNull();
		expect(currentWeek(season, new Date('2026-10-04T12:00:00Z'))).toBe(1);
		expect(currentWeek(season, new Date('2026-10-09T12:00:00Z'))).toBe(1);
		expect(currentWeek(season, new Date('2026-10-11T12:00:00Z'))).toBe(2);
		// Just after the DST change, inside week 4.
		expect(currentWeek(season, new Date('2026-10-24T22:30:00Z'))).toBe(4);
		expect(currentWeek(season, new Date('2026-10-24T21:30:00Z'))).toBe(3);
		expect(currentWeek(season, new Date('2027-01-02T12:00:00Z'))).toBe(13);
		expect(currentWeek(season, new Date('2027-01-03T12:00:00Z'))).toBeNull();
	});

	it('reveals only weeks past their open phase', () => {
		expect(revealedWeeks(season, new Date('2026-10-05T12:00:00Z'))).toEqual([]);
		expect(revealedWeeks(season, new Date('2026-10-08T12:00:00Z'))).toEqual([1]);
		expect(revealedWeeks(season, new Date('2026-10-12T12:00:00Z'))).toEqual([1]);
		expect(revealedWeeks(season, new Date('2026-10-15T12:00:00Z'))).toEqual([1, 2]);
	});
});
