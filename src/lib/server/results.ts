import type { Repo } from './repo';
import { revealedWeeks, type Season } from './schedule';
import { seasonStandings, type SeasonWeek, type WeekResult } from './scoring';

// Bridges stored attempts to the pure scoring functions.

export function solveMs(a: { startedAt: string; finishedAt: string | null }): number | null {
	return a.finishedAt ? Date.parse(a.finishedAt) - Date.parse(a.startedAt) : null;
}

export function weekResults(repo: Repo, puzzleId: number): WeekResult[] {
	return repo.attemptsForPuzzle(puzzleId).map((a) => ({
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
