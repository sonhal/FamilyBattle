import { season } from '#lib/server/index.ts';
import { dropsAt, opensAt, puzzleCount, reviewStartsAt } from '#lib/server/schedule.ts';
import { DROP_WORST, POINTS } from '#lib/server/scoring.ts';
import type { DateTime } from 'luxon';
import type { PageServerLoad } from './$types';

// Dates and weekdays in Oslo time. The game runs on Oslo time, so formatting
// on the server is right for everyone who plays.
const nb = (t: DateTime, format: string) => t.setLocale('nb').toFormat(format);

/** "mandag, onsdag og fredag" */
function joinNb(items: string[]): string {
	return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} og ${items.at(-1)}`;
}

function dropDays(week: number): string {
	return joinNb(
		Array.from({ length: puzzleCount(season, week) }, (_, i) =>
			nb(dropsAt(season, week, i + 1), 'cccc')
		)
	);
}

export const load: PageServerLoad = () => {
	const last = season.weeks;
	const singleWeeks = Math.min(season.singleWeeks ?? 0, last);
	// A regular three-puzzle week: the first one after the single-puzzle weeks.
	const regular = Math.min(singleWeeks + 1, last);
	const reveal = reviewStartsAt(season, last);
	return {
		weeks: season.weeks,
		singleWeeks,
		perWeek: puzzleCount(season, regular),
		points: POINTS,
		dropWorst: DROP_WORST,
		seasonStart: nb(opensAt(season, 1), 'cccc d. MMMM'),
		dropDays: dropDays(regular),
		playEndsDay: nb(reviewStartsAt(season, regular).minus({ minutes: 1 }), 'cccc'),
		revealDay: nb(reviewStartsAt(season, regular), 'cccc'),
		finalDropDays: dropDays(last),
		finalEnd: nb(reveal, "cccc d. MMMM 'kl.' HH.mm"),
		winnerOnNewYearsEve: reveal.month === 12 && reveal.day === 31
	};
};
