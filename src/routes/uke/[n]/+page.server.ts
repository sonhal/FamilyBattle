import { error, redirect } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { liveSeasonWeek, liveWeek, revealedSeasonWeeks } from '#lib/server/results.ts';
import { dropsAt, phaseOf, puzzleCount, reviewStartsAt } from '#lib/server/schedule.ts';
import { isWeekVoided, scoreWeek, type SeasonWeek } from '#lib/server/scoring.ts';
import { parseWeek } from './params';
import type { PageServerLoad } from './$types';

/**
 * The week's ranking by average points over its puzzles. A single-puzzle week
 * has nothing to average, so it goes straight to the puzzle.
 */
export const load: PageServerLoad = ({ params, locals }) => {
	const week = parseWeek(params.n);
	if (puzzleCount(season, week) === 1) redirect(307, `/uke/${week}/1`);

	const t = now();
	const phase = phaseOf(season, week, t);
	if (phase === 'upcoming') error(404, 'Resultatene er ikke klare ennå.');

	let seasonWeek: SeasonWeek | undefined;
	let finished: number[] | null = null;
	if (phase === 'open') {
		// Provisional: only the puzzles this viewer has finished, finished attempts only.
		const live = liveWeek(repo, season, t, locals.player.id);
		if (live?.week !== week)
			error(404, 'Fullfør en av ukens oppgaver for å se resultatene så langt.');
		seasonWeek = liveSeasonWeek(repo, live);
		finished = live.finished;
	} else {
		seasonWeek = revealedSeasonWeeks(repo, season, t).find((w) => w.week === week);
	}
	if (!seasonWeek) error(404, 'Ingen oppgaver denne uken.');

	const names = new Map(repo.players().map((p) => [p.id, p.displayName]));
	const day = (slot: number) =>
		dropsAt(season, week, slot)
			.setLocale('nb')
			.toFormat('cccc')
			.replace(/^./, (c) => c.toUpperCase());

	return {
		week,
		weeks: season.weeks,
		live: phase === 'open',
		revealsAt: reviewStartsAt(season, week).toISO()!,
		voided: isWeekVoided(seasonWeek),
		puzzles: seasonWeek.puzzles.map((p) => ({
			slot: p.slot,
			day: day(p.slot),
			voided: p.voided,
			// While the week is open, only puzzles the viewer has finished have a page.
			linked: finished === null || finished.includes(p.slot)
		})),
		ranking: scoreWeek(seasonWeek.puzzles).map((s) => ({
			name: names.get(s.playerId) ?? '?',
			isMe: s.playerId === locals.player.id,
			place: s.place,
			points: s.points,
			puzzles: s.puzzles.map((x) => ({ slot: x.slot, points: x.placement?.points ?? null }))
		}))
	};
};
