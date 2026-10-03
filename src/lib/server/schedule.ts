import { DateTime } from 'luxon';

// Phase boundaries follow Norwegian local time. Luxon handles the DST switch
// (last Sunday of October, 03:00), which never lands on a 00:00 boundary.
export const ZONE = 'Europe/Oslo';

export type Phase = 'upcoming' | 'open' | 'review' | 'closed';

export interface Season {
	start: string; // ISO date of week 1's Sunday, e.g. 2026-10-04
	weeks: number;
}

/** Sunday 00:00: the puzzle opens. */
export function opensAt(season: Season, week: number): DateTime {
	return DateTime.fromISO(season.start, { zone: ZONE })
		.startOf('day')
		.plus({ weeks: week - 1 });
}

/** Thursday 00:00: play closes, answers and standings are revealed. */
export function reviewStartsAt(season: Season, week: number): DateTime {
	return opensAt(season, week).plus({ days: 4 });
}

/** Next Sunday 00:00: voting locks, the next puzzle opens. */
export function closesAt(season: Season, week: number): DateTime {
	return opensAt(season, week).plus({ weeks: 1 });
}

export function phaseOf(season: Season, week: number, now: Date): Phase {
	const t = DateTime.fromJSDate(now);
	if (t < opensAt(season, week)) return 'upcoming';
	if (t < reviewStartsAt(season, week)) return 'open';
	if (t < closesAt(season, week)) return 'review';
	return 'closed';
}

/**
 * The week whose open or review phase contains `now`, or null before the
 * season starts and after the last week's review ends.
 */
export function currentWeek(season: Season, now: Date): number | null {
	const t = DateTime.fromJSDate(now);
	const start = opensAt(season, 1);
	if (t < start) return null;
	const week = Math.floor(t.diff(start, 'weeks').weeks) + 1;
	// The diff can be off by an hour across DST; correct against real boundaries.
	for (const w of [week - 1, week, week + 1]) {
		if (w < 1 || w > season.weeks) continue;
		const p = phaseOf(season, w, now);
		if (p === 'open' || p === 'review') return w;
	}
	return null;
}

/** Weeks whose results may be shown: review or closed. */
export function revealedWeeks(season: Season, now: Date): number[] {
	const weeks: number[] = [];
	for (let w = 1; w <= season.weeks; w++) {
		const p = phaseOf(season, w, now);
		if (p === 'review' || p === 'closed') weeks.push(w);
	}
	return weeks;
}
