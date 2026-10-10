import { DateTime } from 'luxon';

// Phase boundaries follow Norwegian local time. Luxon handles the DST switch
// (last Sunday of October, 03:00), which never lands on a 00:00 boundary.
export const ZONE = 'Europe/Oslo';

export type Phase = 'upcoming' | 'open' | 'review' | 'closed';

export interface Season {
	start: string; // ISO date of week 1's first day, e.g. 2026-10-04
	weeks: number;
	/**
	 * Leading weeks in the original format: one puzzle, open Sun–Wed, review Thu–Sat.
	 * Later weeks start on Monday and have three puzzles.
	 */
	singleWeeks?: number;
}

/** Puzzles per week in the three-puzzle format. */
export const PUZZLES_PER_WEEK = 3;

function isSingle(season: Season, week: number): boolean {
	return week <= (season.singleWeeks ?? 0);
}

/** The final week is compressed so the winner is known on Thursday afternoon. */
function isFinal(season: Season, week: number): boolean {
	return week === season.weeks && !isSingle(season, week);
}

function weekStart(season: Season, week: number): DateTime {
	return DateTime.fromISO(season.start, { zone: ZONE })
		.startOf('day')
		.plus({ weeks: week - 1 });
}

/** The first Monday on or after the week's start day. */
function monday(season: Season, week: number): DateTime {
	const d = weekStart(season, week);
	return d.plus({ days: (8 - d.weekday) % 7 });
}

export function puzzleCount(season: Season, week: number): number {
	return isSingle(season, week) ? 1 : PUZZLES_PER_WEEK;
}

/**
 * When puzzle `slot` (1-based) of a week becomes playable: Sunday for a
 * single-puzzle week, otherwise Mon/Wed/Fri (Mon/Tue/Wed in the final week).
 */
export function dropsAt(season: Season, week: number, slot: number): DateTime {
	if (isSingle(season, week)) return weekStart(season, week);
	const step = isFinal(season, week) ? 1 : 2;
	return monday(season, week).plus({ days: (slot - 1) * step });
}

/** The week's first puzzle drops. */
export function opensAt(season: Season, week: number): DateTime {
	return dropsAt(season, week, 1);
}

/**
 * Play closes for every puzzle in the week, and answers and results are revealed:
 * Thursday 00:00 for a single-puzzle week, the next Monday 00:00 otherwise, and
 * Thursday 16:00 in the final week.
 */
export function reviewStartsAt(season: Season, week: number): DateTime {
	if (isSingle(season, week)) return weekStart(season, week).plus({ days: 4 });
	if (isFinal(season, week)) return monday(season, week).plus({ days: 3, hours: 16 });
	return monday(season, week).plus({ weeks: 1 });
}

/** Voting locks. Single-puzzle weeks: when the next week opens. Otherwise a week after the reveal. */
export function reviewEndsAt(season: Season, week: number): DateTime {
	if (isSingle(season, week)) {
		return week < season.weeks ? opensAt(season, week + 1) : weekStart(season, week + 1);
	}
	return reviewStartsAt(season, week).plus({ weeks: 1 });
}

export function phaseOf(season: Season, week: number, now: Date): Phase {
	const t = DateTime.fromJSDate(now);
	if (t < opensAt(season, week)) return 'upcoming';
	if (t < reviewStartsAt(season, week)) return 'open';
	if (t < reviewEndsAt(season, week)) return 'review';
	return 'closed';
}

/** A puzzle can be played once it has dropped and until its week's play closes. */
export function isPlayable(season: Season, week: number, slot: number, now: Date): boolean {
	return (
		slot >= 1 &&
		slot <= puzzleCount(season, week) &&
		DateTime.fromJSDate(now) >= dropsAt(season, week, slot) &&
		phaseOf(season, week, now) === 'open'
	);
}

/**
 * The week that is open right now, or else the latest week in review; null
 * before the season starts and after the last week's review ends. A week's
 * review overlaps the next week's play, and the open week wins.
 */
export function currentWeek(season: Season, now: Date): number | null {
	let reviewing: number | null = null;
	for (let w = 1; w <= season.weeks; w++) {
		const p = phaseOf(season, w, now);
		if (p === 'open') return w;
		if (p === 'review') reviewing = w;
	}
	return reviewing;
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
