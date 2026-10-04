import { repo, season } from '#lib/server/index.ts';
import { now } from '#lib/server/config.ts';
import { seasonWeeksFor } from '#lib/server/results.ts';
import { DROP_WORST, seasonStandings } from '#lib/server/scoring.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	// Includes this week's provisional results once the viewer has finished it.
	const { weeks, liveWeek } = seasonWeeksFor(repo, season, now(), locals.player.id);
	const names = new Map(repo.players().map((p) => [p.id, p.displayName]));
	const voided = weeks.filter((w) => w.voided).length;

	return {
		seasonWeeks: season.weeks,
		liveWeek,
		countedWeeks: Math.max(1, season.weeks - voided - DROP_WORST),
		weeks: weeks
			.filter((w) => w.week !== liveWeek)
			.map((w) => ({ week: w.week, voided: w.voided })),
		standings: seasonStandings(weeks, season.weeks).map((s) => ({
			name: names.get(s.playerId) ?? '?',
			isMe: s.playerId === locals.player.id,
			place: s.place,
			total: s.total,
			wins: s.wins,
			weeks: s.weeks
		}))
	};
};
