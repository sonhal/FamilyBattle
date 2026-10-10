import type { PuzzleRow, Repo } from './repo';
import { currentWeek, isPlayable, phaseOf, revealedWeeks, type Season } from './schedule';
import { seasonStandings, type SeasonWeek, type WeekResult } from './scoring';

// Bridges stored attempts to the pure scoring functions.

export function solveMs(a: { startedAt: string; finishedAt: string | null }): number | null {
	return a.finishedAt ? Date.parse(a.finishedAt) - Date.parse(a.startedAt) : null;
}

export function puzzleResults(
	repo: Repo,
	puzzleId: number,
	opts: { finishedOnly?: boolean } = {}
): WeekResult[] {
	return repo
		.attemptsForPuzzle(puzzleId)
		.filter((a) => !opts.finishedOnly || a.finishedAt !== null)
		.map((a) => ({
			playerId: a.playerId,
			groupsSolved: a.groupsSolved,
			mistakes: a.mistakes,
			solveMs: solveMs(a)
		}));
}

/** Only weeks past their open phase are included, so standings never leak an open week. */
export function revealedSeasonWeeks(repo: Repo, season: Season, now: Date): SeasonWeek[] {
	const weeks: SeasonWeek[] = [];
	for (const week of revealedWeeks(season, now)) {
		const puzzles = repo.puzzlesForWeek(week);
		if (puzzles.length === 0) continue;
		weeks.push({
			week,
			puzzles: puzzles.map((p) => ({
				slot: p.slot!,
				voided: p.status === 'voided',
				results: puzzleResults(repo, p.id)
			}))
		});
	}
	return weeks;
}

export function standingsAt(repo: Repo, season: Season, now: Date) {
	return seasonStandings(revealedSeasonWeeks(repo, season, now), season.weeks);
}

/**
 * The week that is open right now and the slots of it that `playerId` has
 * finished, or null if they have finished none.
 *
 * Finished players see a provisional ranking while others are still playing.
 * Only finished attempts take part: someone who is mid-game shows up as
 * playing, never with their partial score. A puzzle the viewer hasn't
 * finished stays hidden, and answers are never part of this.
 */
export function liveWeek(repo: Repo, season: Season, now: Date, playerId: number) {
	const week = currentWeek(season, now);
	if (week === null || phaseOf(season, week, now) !== 'open') return null;
	const puzzles = repo.puzzlesForWeek(week);
	const finished = puzzles
		.filter((p) => isPlayable(season, week, p.slot!, now))
		.filter((p) => repo.attempt(p.id, playerId)?.finishedAt)
		.map((p) => p.slot!);
	if (finished.length === 0) return null;
	return { week, puzzles, finished };
}

/** The open puzzle `slot` of `week`, if `playerId` has finished it; otherwise null. */
export function livePuzzle(
	repo: Repo,
	season: Season,
	now: Date,
	playerId: number,
	week: number,
	slot: number
): PuzzleRow | null {
	const live = liveWeek(repo, season, now, playerId);
	if (live?.week !== week || !live.finished.includes(slot)) return null;
	return live.puzzles.find((p) => p.slot === slot) ?? null;
}

/**
 * The open week as provisional results for `playerId`: finished attempts on
 * the puzzles they have finished. Their other puzzles have no results yet, so
 * they count as 0 for everyone and the average keeps its final denominator.
 */
export function liveSeasonWeek(repo: Repo, live: NonNullable<ReturnType<typeof liveWeek>>) {
	return {
		week: live.week,
		puzzles: live.puzzles.map((p) => ({
			slot: p.slot!,
			voided: p.status === 'voided',
			results: live.finished.includes(p.slot!)
				? puzzleResults(repo, p.id, { finishedOnly: true })
				: []
		}))
	} satisfies SeasonWeek;
}

/** Revealed weeks, plus the open week (finished attempts only) when the viewer has finished a puzzle in it. */
export function seasonWeeksFor(
	repo: Repo,
	season: Season,
	now: Date,
	playerId: number
): { weeks: SeasonWeek[]; liveWeek: number | null } {
	const weeks = revealedSeasonWeeks(repo, season, now);
	const live = liveWeek(repo, season, now, playerId);
	if (!live) return { weeks, liveWeek: null };
	weeks.push(liveSeasonWeek(repo, live));
	return { weeks, liveWeek: live.week };
}
