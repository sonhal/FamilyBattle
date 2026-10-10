import { error, fail } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { guessGrid } from '#lib/server/game.ts';
import type { PuzzleRow } from '#lib/server/repo.ts';
import { livePuzzle, puzzleResults, solveMs } from '#lib/server/results.ts';
import { phaseOf, puzzleCount, reviewEndsAt, reviewStartsAt } from '#lib/server/schedule.ts';
import { rankWeek } from '#lib/server/scoring.ts';
import { parseSlot, parseWeek } from '../params';
import type { Actions, PageServerLoad } from './$types';

function revealedPuzzle(params: { n: string; p: string }) {
	const week = parseWeek(params.n);
	const slot = parseSlot(week, params.p);
	const phase = phaseOf(season, week, now());
	// Answers stay hidden until play has closed for everyone.
	if (phase === 'upcoming' || phase === 'open') error(404, 'Resultatene er ikke klare ennå.');
	const puzzle = repo.puzzle(week, slot);
	if (!puzzle) error(404, 'Ingen oppgave her.');
	return { week, slot, phase, puzzle };
}

function ranking(puzzle: PuzzleRow, playerId: number, finishedOnly: boolean) {
	const names = new Map(repo.players().map((p) => [p.id, p.displayName]));
	const attempts = new Map(repo.attemptsForPuzzle(puzzle.id).map((a) => [a.playerId, a]));
	return rankWeek(puzzleResults(repo, puzzle.id, { finishedOnly })).map((p) => {
		const a = attempts.get(p.playerId)!;
		return {
			name: names.get(p.playerId) ?? '?',
			isMe: p.playerId === playerId,
			place: p.place,
			points: p.points,
			groupsSolved: p.groupsSolved,
			mistakes: p.mistakes,
			solveMs: solveMs(a),
			grid: guessGrid(puzzle.groups, a.guesses)
		};
	});
}

/**
 * While a week is open, a player who has finished one of its puzzles sees a
 * provisional ranking of everyone else who has finished it. No answers, no
 * votes, and unfinished attempts appear only as "playing", without their progress.
 */
function liveResults(week: number, slot: number, playerId: number) {
	const puzzle = livePuzzle(repo, season, now(), playerId, week, slot);
	if (!puzzle) error(404, 'Fullfør oppgaven for å se resultatene så langt.');
	const names = new Map(repo.players().map((p) => [p.id, p.displayName]));
	const playing = repo
		.attemptsForPuzzle(puzzle.id)
		.filter((a) => a.finishedAt === null)
		.map((a) => names.get(a.playerId) ?? '?')
		.sort((a, b) => a.localeCompare(b, 'nb'));

	return {
		live: true as const,
		week,
		slot,
		slots: puzzleCount(season, week),
		voided: puzzle.status === 'voided',
		ranking: ranking(puzzle, playerId, true),
		playing,
		revealsAt: reviewStartsAt(season, week).toISO()!
	};
}

export const load: PageServerLoad = ({ params, locals }) => {
	const n = parseWeek(params.n);
	if (phaseOf(season, n, now()) === 'open') {
		return liveResults(n, parseSlot(n, params.p), locals.player.id);
	}

	const { week, slot, phase, puzzle } = revealedPuzzle(params);
	const played = repo.attempt(puzzle.id, locals.player.id) !== null;
	return {
		live: false as const,
		week,
		slot,
		slots: puzzleCount(season, week),
		groups: puzzle.groups,
		voided: puzzle.status === 'voided',
		ranking: ranking(puzzle, locals.player.id, false),
		vote: {
			open: phase === 'review',
			allowed: phase === 'review' && played,
			played,
			mine: repo.vote(puzzle.id, locals.player.id),
			locksAt: reviewEndsAt(season, week).toISO()!
		}
	};
};

export const actions: Actions = {
	vote: async ({ params, locals, request }) => {
		const { phase, puzzle } = revealedPuzzle(params);
		if (phase !== 'review') return fail(409, { message: 'Avstemningen er stengt.' });
		if (!repo.attempt(puzzle.id, locals.player.id)) {
			return fail(403, { message: 'Bare de som har spilt kan stemme.' });
		}
		const value = (await request.formData()).get('vote');
		if (value !== 'bad' && value !== 'fine') return fail(400, { message: 'Ugyldig stemme.' });
		repo.setVote(puzzle.id, locals.player.id, value === 'bad', now());
		return { saved: true };
	}
};
