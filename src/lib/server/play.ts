import type { Repo } from './repo';
import { currentWeek, dropsAt, isPlayable, phaseOf, puzzleCount, type Season } from './schedule';

// What a player sees of the open week's puzzles: which have dropped, and how
// far they are with each. Never puzzle contents.

export type SlotState = 'upcoming' | 'missing' | 'new' | 'playing' | 'finished';

export interface SlotStatus {
	slot: number;
	dropsAt: string;
	/** Weekday of the drop in Oslo time, e.g. "Mandag". */
	day: string;
	state: SlotState;
}

export function slotStatuses(
	repo: Repo,
	season: Season,
	now: Date,
	week: number,
	playerId: number
): SlotStatus[] {
	return Array.from({ length: puzzleCount(season, week) }, (_, i) => {
		const slot = i + 1;
		const at = dropsAt(season, week, slot);
		const base = {
			slot,
			dropsAt: at.toISO()!,
			day: at
				.setLocale('nb')
				.toFormat('cccc')
				.replace(/^./, (c) => c.toUpperCase())
		};
		if (!isPlayable(season, week, slot, now)) return { ...base, state: 'upcoming' as const };
		const puzzle = repo.puzzle(week, slot);
		if (!puzzle) return { ...base, state: 'missing' as const };
		const attempt = repo.attempt(puzzle.id, playerId);
		const state = !attempt ? 'new' : attempt.finishedAt ? 'finished' : 'playing';
		return { ...base, state };
	});
}

/**
 * The puzzle to show when none is asked for: the earliest one the player
 * hasn't finished, else the latest that has dropped.
 */
export function defaultSlot(slots: SlotStatus[]): number {
	const unfinished = slots.find((s) => s.state === 'new' || s.state === 'playing');
	if (unfinished) return unfinished.slot;
	const dropped = slots.filter((s) => s.state !== 'upcoming');
	return dropped.at(-1)?.slot ?? 1;
}

/** Puzzles in the open week the player hasn't started, for the "Ny" badge. */
export function unstartedCount(repo: Repo, season: Season, now: Date, playerId: number): number {
	const week = currentWeek(season, now);
	if (week === null || phaseOf(season, week, now) !== 'open') return 0;
	return slotStatuses(repo, season, now, week, playerId).filter((s) => s.state === 'new').length;
}
