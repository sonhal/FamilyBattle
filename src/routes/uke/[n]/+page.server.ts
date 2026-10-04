import { error, fail } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { guessGrid } from '#lib/server/game.ts';
import { solveMs, weekResults } from '#lib/server/results.ts';
import { closesAt, phaseOf } from '#lib/server/schedule.ts';
import { rankWeek } from '#lib/server/scoring.ts';
import type { Actions, PageServerLoad } from './$types';

function revealedPuzzle(param: string) {
	const week = Number(param);
	if (!Number.isInteger(week) || week < 1 || week > season.weeks) error(404, 'Ukjent uke.');
	const phase = phaseOf(season, week, now());
	// Answers stay hidden until play has closed for everyone.
	if (phase === 'upcoming' || phase === 'open') error(404, 'Resultatene er ikke klare ennå.');
	const puzzle = repo.puzzleForWeek(week);
	if (!puzzle) error(404, 'Ingen oppgave denne uken.');
	return { week, phase, puzzle };
}

export const load: PageServerLoad = ({ params, locals }) => {
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
