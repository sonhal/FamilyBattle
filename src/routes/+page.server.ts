import { fail } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { applyGuess } from '#lib/server/game.ts';
import { createRateLimiter } from '#lib/server/rate-limit.ts';
import { closesAt, currentWeek, opensAt, phaseOf, reviewStartsAt } from '#lib/server/schedule.ts';
import { boardView } from '#lib/server/views.ts';
import type { Actions, PageServerLoad } from './$types';

const guessLimiter = createRateLimiter(10, 10_000);

export const load: PageServerLoad = ({ locals }) => {
	const t = now();
	const week = currentWeek(season, t);
	const playerCount = repo.players().length;

	if (week === null) {
		const beforeSeason = t < opensAt(season, 1).toJSDate();
		return beforeSeason
			? { state: 'before' as const, opensAt: opensAt(season, 1).toISO()! }
			: { state: 'over' as const };
	}

	const phase = phaseOf(season, week, t);
	const puzzle = repo.puzzleForWeek(week);
	const base = {
		week,
		weeks: season.weeks,
		closesAt: reviewStartsAt(season, week).toISO()!,
		nextOpensAt: closesAt(season, week).toISO()!,
		playerCount
	};

	if (!puzzle) return { ...base, state: 'missing' as const };
	if (phase !== 'open') return { ...base, state: 'review' as const };

	const playedCount = repo.countAttempts(puzzle.id);
	const attempt = repo.attempt(puzzle.id, locals.player.id);
	if (!attempt) return { ...base, state: 'not_started' as const, playedCount };

	return {
		...base,
		state: 'playing' as const,
		playedCount,
		board: boardView(puzzle.groups, attempt, `${locals.player.id}:${puzzle.id}`)
	};
};

/** The open puzzle, or null if nothing can be played right now. */
function openPuzzle() {
	const t = now();
	const week = currentWeek(season, t);
	if (week === null || phaseOf(season, week, t) !== 'open') return null;
	return repo.puzzleForWeek(week);
}

export const actions: Actions = {
	start: ({ locals }) => {
		const puzzle = openPuzzle();
		if (!puzzle) return fail(409, { message: 'This puzzle is not open.' });
		repo.startAttempt(puzzle.id, locals.player.id, now());
	},

	guess: async ({ locals, request }) => {
		if (!guessLimiter(String(locals.player.id))) {
			return fail(429, { message: 'Slow down a little.' });
		}
		const words = (await request.formData()).getAll('word');

		const puzzle = openPuzzle();
		if (!puzzle) return fail(409, { message: 'This puzzle has closed.' });

		// better-sqlite3 transactions are synchronous, so two quick taps on
		// Submit are applied one after the other, never interleaved.
		const outcome = repo.db.transaction(() => {
			const attempt = repo.attempt(puzzle.id, locals.player.id);
			if (!attempt) return { kind: 'invalid' as const, reason: 'Start the puzzle first.' };
			const out = applyGuess(puzzle.groups, attempt, words, now());
			if (out.kind === 'scored') repo.saveAttempt(attempt.id, out.state);
			if (out.kind === 'already_guessed') repo.bumpSubmissions(attempt.id);
			return out;
		})();

		if (outcome.kind === 'invalid') return fail(400, { message: outcome.reason });
		if (outcome.kind === 'already_guessed') return { result: 'already_guessed' as const };
		return { result: outcome.verdict };
	}
};
