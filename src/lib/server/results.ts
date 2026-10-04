import type { Repo } from './repo';
import { currentWeek, phaseOf, revealedWeeks, type Season } from './schedule';
import { seasonStandings, type SeasonWeek, type WeekResult } from './scoring';

// Bridges stored attempts to the pure scoring functions.

export function solveMs(a: { startedAt: string; finishedAt: string | null }): number | null {
	return a.finishedAt ? Date.parse(a.finishedAt) - Date.parse(a.startedAt) : null;
}

export function weekResults(
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
		const puzzle = repo.puzzleForWeek(week);
		if (!puzzle) continue;
		weeks.push({ week, voided: puzzle.status === 'voided', results: weekResults(repo, puzzle.id) });
	}
	return weeks;
}

export function standingsAt(repo: Repo, season: Season, now: Date) {
	return seasonStandings(revealedSeasonWeeks(repo, season, now), season.weeks);
}

/**
 * The week that is open right now, if `playerId` has finished it; otherwise null.
 *
 * Finished players see a provisional ranking while others are still playing.
 * Only finished attempts take part: someone who is mid-game shows up as
 * playing, never with their partial score. Answers are not part of this.
 */
export function liveWeek(repo: Repo, season: Season, now: Date, playerId: number) {
	const week = currentWeek(season, now);
	if (week === null || phaseOf(season, week, now) !== 'open') return null;
	const puzzle = repo.puzzleForWeek(week);
	if (!puzzle) return null;
	const mine = repo.attempt(puzzle.id, playerId);
	if (!mine?.finishedAt) return null;
	return { week, puzzle };
}

/** Revealed weeks, plus the open week (finished attempts only) when the viewer has finished it. */
export function seasonWeeksFor(
	repo: Repo,
	season: Season,
	now: Date,
	playerId: number
): { weeks: SeasonWeek[]; liveWeek: number | null } {
	const weeks = revealedSeasonWeeks(repo, season, now);
	const live = liveWeek(repo, season, now, playerId);
	if (!live) return { weeks, liveWeek: null };
	weeks.push({
		week: live.week,
		voided: live.puzzle.status === 'voided',
		results: weekResults(repo, live.puzzle.id, { finishedOnly: true })
	});
	return { weeks, liveWeek: live.week };
}
