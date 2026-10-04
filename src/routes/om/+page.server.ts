import { season } from '#lib/server/index.ts';
import { closesAt, opensAt, reviewStartsAt } from '#lib/server/schedule.ts';
import { DROP_WORST, POINTS } from '#lib/server/scoring.ts';
import type { DateTime } from 'luxon';
import type { PageServerLoad } from './$types';

// Dates only (no times), so formatting them in Oslo time on the server is safe.
const day = (t: DateTime) => t.setLocale('nb').toFormat('cccc d. MMMM');

export const load: PageServerLoad = () => {
	const last = season.weeks;
	const reveal = reviewStartsAt(season, last);
	return {
		weeks: season.weeks,
		points: POINTS,
		dropWorst: DROP_WORST,
		seasonStart: day(opensAt(season, 1)),
		lastPlayDay: day(reveal.minus({ days: 1 })),
		winnerDay: day(reveal),
		winnerOnNewYearsEve: reveal.month === 12 && reveal.day === 31,
		seasonEnd: day(closesAt(season, last))
	};
};
