import { error, fail } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { guessGrid } from '#lib/server/game.ts';
import { liveWeek, solveMs, weekResults } from '#lib/server/results.ts';
import { closesAt, phaseOf, reviewStartsAt } from '#lib/server/schedule.ts';
import { rankWeek } from '#lib/server/scoring.ts';
import type { Actions, PageServerLoad } from './$types';

function parseWeek(param: string) {
	const week = Number(param);
	if (!Number.isInteger(week) || week < 1 || week > season.weeks) error(404, 'Ukjent uke.');
	return week;
}

function revealedPuzzle(param: string) {
	const week = parseWeek(param);
	const phase = phaseOf(season, week, now());
	// Answers stay hidden until play has closed for everyone.
	if (phase === 'upcoming' || phase === 'open') error(404, 'Resultatene er ikke klare ennå.');
	const puzzle = repo.puzzleForWeek(week);
	if (!puzzle) error(404, 'Ingen oppgave denne uken.');
	return { week, phase, puzzle };
}

/**
 * While a week is open, a player who has finished it sees a provisional
 * ranking of everyone else who has finished. No answers, no votes, and
 * unfinished attempts appear only as "playing", without their progress.
 */
function liveResults(week: number, playerId: number) {
	const live = liveWeek(repo, season, now(), playerId);
	if (live?.week !== week) error(404, 'Fullfør ukens oppgave for å se resultatene så langt.');
	const { puzzle } = live;
	const names = new Map(repo.players().map((p) => [p.id, p.displayName]));
	const attempts = repo.attemptsForPuzzle(puzzle.id);
	const byPlayer = new Map(attempts.map((a) => [a.playerId, a]));

	const ranking = rankWeek(weekResults(repo, puzzle.id, { finishedOnly: true })).map((p) => {
		const a = byPlayer.get(p.playerId)!;
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
	const playing = attempts
		.filter((a) => a.finishedAt === null)
		.map((a) => names.get(a.playerId) ?? '?')
		.sort((a, b) => a.localeCompare(b, 'nb'));

	return {
		live: true as const,
		week,
		weeks: season.weeks,
		voided: puzzle.status === 'voided',
		ranking,
		playing,
		revealsAt: reviewStartsAt(season, week).toISO()!
	};
}

export const load: PageServerLoad = ({ params, locals }) => {
	const n = parseWeek(params.n);
	if (phaseOf(season, n, now()) === 'open') return liveResults(n, locals.player.id);

	const { week, phase, puzzle } = revealedPuzzle(params.n);
	const names = new Map(repo.players().map((p) => [p.id, p.displayName]));
	const attempts = new Map(repo.attemptsForPuzzle(puzzle.id).map((a) => [a.playerId, a]));

	const ranking = rankWeek(weekResults(repo, puzzle.id)).map((p) => {
		const a = attempts.get(p.playerId)!;
		return {
			name: names.get(p.playerId) ?? '?',
			isMe: p.playerId === locals.player.id,
			place: p.place,
			points: p.points,
			groupsSolved: p.groupsSolved,
			mistakes: p.mistakes,
			solveMs: solveMs(a),
			grid: guessGrid(puzzle.groups, a.guesses)
		};
	});

	const played = attempts.has(locals.player.id);
	return {
		live: false as const,
		week,
		weeks: season.weeks,
		groups: puzzle.groups,
		voided: puzzle.status === 'voided',
		ranking,
		vote: {
			open: phase === 'review',
			allowed: phase === 'review' && played,
			played,
			mine: repo.vote(puzzle.id, locals.player.id),
			locksAt: closesAt(season, week).toISO()!
		}
	};
};

export const actions: Actions = {
	vote: async ({ params, locals, request }) => {
		const { phase, puzzle } = revealedPuzzle(params.n);
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
