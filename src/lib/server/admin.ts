import type { Repo } from './repo';
import { dropsAt, phaseOf, puzzleCount, type Phase, type Season } from './schedule';

// Admin overview and voiding. Deliberately never exposes puzzle contents:
// the admin also plays, and the honor system is easier to keep that way.

export interface AdminPuzzle {
	slot: number;
	/** Drop day in Oslo time, e.g. "ons. 21.10." */
	dropDay: string;
	hasPuzzle: boolean;
	status: 'active' | 'voided' | null;
	voidNote: string | null;
	played: number;
	votesBad: number;
	votesFine: number;
}

export interface AdminWeek {
	week: number;
	phase: Phase;
	puzzles: AdminPuzzle[];
	/** Voiding is possible once play has closed for the week. */
	canVoid: boolean;
}

export function adminOverview(repo: Repo, season: Season, now: Date) {
	const weeks: AdminWeek[] = [];
	for (let week = 1; week <= season.weeks; week++) {
		const phase = phaseOf(season, week, now);
		const puzzles: AdminPuzzle[] = [];
		for (let slot = 1; slot <= puzzleCount(season, week); slot++) {
			const puzzle = repo.puzzle(week, slot);
			const votes = puzzle ? repo.voteTotals(puzzle.id) : { bad: 0, fine: 0 };
			puzzles.push({
				slot,
				dropDay: dropsAt(season, week, slot).setLocale('nb').toFormat('ccc d.M.'),
				hasPuzzle: puzzle !== null,
				status: puzzle?.status ?? null,
				voidNote: puzzle?.voidNote ?? null,
				played: puzzle ? repo.countAttempts(puzzle.id) : 0,
				votesBad: votes.bad,
				votesFine: votes.fine
			});
		}
		weeks.push({ week, phase, puzzles, canVoid: phase === 'review' || phase === 'closed' });
	}
	const reserves = repo.allPuzzles().filter((p) => p.week === null).length;
	return { weeks, reserves };
}

export type VoidResult = { ok: true } | { ok: false; message: string };

/** Voids or restores one puzzle. Messages are shown to the admin, so they are Norwegian. */
export function setPuzzleVoided(
	repo: Repo,
	season: Season,
	now: Date,
	week: number,
	slot: number,
	voided: boolean,
	note: string | null
): VoidResult {
	if (!Number.isInteger(week) || week < 1 || week > season.weeks) {
		return { ok: false, message: 'Ukjent uke.' };
	}
	if (!Number.isInteger(slot) || slot < 1 || slot > puzzleCount(season, week)) {
		return { ok: false, message: 'Ukjent oppgave.' };
	}
	const puzzle = repo.puzzle(week, slot);
	if (!puzzle) return { ok: false, message: 'Oppgaven finnes ikke.' };
	const phase = phaseOf(season, week, now);
	if (phase !== 'review' && phase !== 'closed') {
		return { ok: false, message: 'En oppgave kan bare annulleres etter at uka har stengt.' };
	}
	const cleanNote = note?.trim().slice(0, 500) || null;
	if (voided && !cleanNote) {
		return {
			ok: false,
			message: 'Skriv en kort begrunnelse. Den brukes til å lage bedre oppgaver.'
		};
	}
	// Restoring clears the note: the generator treats every stored note as a lesson.
	repo.setPuzzleStatus(puzzle.id, voided ? 'voided' : 'active', voided ? cleanNote : null);
	return { ok: true };
}
