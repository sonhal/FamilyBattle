import { fail } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { applyGuess } from '#lib/server/game.ts';
import { defaultSlot, slotStatuses } from '#lib/server/play.ts';
import { createRateLimiter } from '#lib/server/rate-limit.ts';
import {
	currentWeek,
	isPlayable,
	opensAt,
	phaseOf,
	puzzleCount,
	reviewStartsAt
} from '#lib/server/schedule.ts';
import { boardView } from '#lib/server/views.ts';
import type { Actions, PageServerLoad } from './$types';

const guessLimiter = createRateLimiter(10, 10_000);

export const load: PageServerLoad = ({ locals, url }) => {
	const t = now();
	const week = currentWeek(season, t);

	if (week === null) {
		const beforeSeason = t < opensAt(season, 1).toJSDate();
		return beforeSeason
			? { state: 'before' as const, opensAt: opensAt(season, 1).toISO()! }
			: { state: 'over' as const };
	}

	const base = {
		week,
		weeks: season.weeks,
		closesAt: reviewStartsAt(season, week).toISO()!
	};

	if (phaseOf(season, week, t) !== 'open') {
		const next = week < season.weeks ? opensAt(season, week + 1).toISO()! : null;
		return { ...base, state: 'review' as const, nextOpensAt: next };
	}

	const slots = slotStatuses(repo, season, t, week, locals.player.id);
	const asked = Number(url.searchParams.get('oppgave'));
	const slot = slots.some((s) => s.slot === asked && s.state !== 'upcoming')
		? asked
		: defaultSlot(slots);
	// The previous week's answers come out while this one is being played.
	const resultsWeek = week > 1 && phaseOf(season, week - 1, t) === 'review' ? week - 1 : null;
	const play = { ...base, slots, slot, resultsWeek };

	const puzzle = repo.puzzle(week, slot);
	if (!puzzle) return { ...play, state: 'missing' as const };

	const playedCount = repo.countAttempts(puzzle.id);
	// Everyone who has logged in, so players who haven't started yet show as missing.
	const playerCount = repo.countPlayers();
	const attempt = repo.attempt(puzzle.id, locals.player.id);
	if (!attempt) return { ...play, state: 'not_started' as const, playedCount, playerCount };

	return {
		...play,
		state: 'playing' as const,
		playedCount,
		playerCount,
		board: boardView(puzzle.groups, attempt, `${locals.player.id}:${puzzle.id}`)
	};
};

/** The puzzle named by `?oppgave=` if it can be played right now, else null. */
function openPuzzle(url: URL) {
	const t = now();
	const week = currentWeek(season, t);
	if (week === null) return null;
	const slot = puzzleCount(season, week) === 1 ? 1 : Number(url.searchParams.get('oppgave'));
	if (!isPlayable(season, week, slot, t)) return null;
	return repo.puzzle(week, slot);
}

export const actions: Actions = {
	start: ({ locals, url }) => {
		const puzzle = openPuzzle(url);
		if (!puzzle) return fail(409, { message: 'Denne oppgaven er ikke åpen.' });
		repo.startAttempt(puzzle.id, locals.player.id, now());
	},

	guess: async ({ locals, request, url }) => {
		if (!guessLimiter(String(locals.player.id))) {
			return fail(429, { message: 'Rolig litt.' });
		}
		const words = (await request.formData()).getAll('word');

		const puzzle = openPuzzle(url);
		if (!puzzle) return fail(409, { message: 'Denne oppgaven er stengt.' });

		// better-sqlite3 transactions are synchronous, so two quick taps on
		// Submit are applied one after the other, never interleaved.
		const outcome = repo.db.transaction(() => {
			const attempt = repo.attempt(puzzle.id, locals.player.id);
			if (!attempt) return { kind: 'invalid' as const, reason: 'Start oppgaven først.' };
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
