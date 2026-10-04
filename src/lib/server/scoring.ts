// Points and standings are always derived from attempts, never stored, so a
// fixed attempt or a voided puzzle shows up on the next page load.

/** Placement points for 1st..7th. Places beyond the table still earn the last value. */
export const POINTS = [10, 7, 5, 4, 3, 2, 1];

/** How many of each player's worst weeks are dropped from the season total. */
export const DROP_WORST = 2;

export interface WeekResult {
	playerId: number;
	groupsSolved: number;
	mistakes: number;
	/** Solve time in ms; null when the attempt never finished (ranks slowest). */
	solveMs: number | null;
}

export interface Placement extends WeekResult {
	place: number;
	points: number;
}

function pointsFor(placeIndex: number): number {
	return POINTS[Math.min(placeIndex, POINTS.length - 1)];
}

function compare(a: WeekResult, b: WeekResult): number {
	if (a.groupsSolved !== b.groupsSolved) return b.groupsSolved - a.groupsSolved;
	if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;
	const at = a.solveMs ?? Infinity;
	const bt = b.solveMs ?? Infinity;
	return at === bt ? 0 : at < bt ? -1 : 1;
}

/**
 * Ranks one week. Players with identical keys share a place and the average
 * of the points for the places they occupy (two tied for 1st get 8.5 each;
 * the next player is 3rd).
 */
export function rankWeek(results: WeekResult[]): Placement[] {
	const sorted = [...results].sort(compare);
	const out: Placement[] = [];
	let i = 0;
	while (i < sorted.length) {
		let j = i + 1;
		while (j < sorted.length && compare(sorted[i], sorted[j]) === 0) j++;
		let sum = 0;
		for (let k = i; k < j; k++) sum += pointsFor(k);
		const points = sum / (j - i);
		for (let k = i; k < j; k++) out.push({ ...sorted[k], place: i + 1, points });
		i = j;
	}
	return out;
}

export interface SeasonWeek {
	week: number;
	voided: boolean;
	results: WeekResult[];
}

export interface PlayerWeek {
	week: number;
	/** null when the player missed the week. */
	place: number | null;
	points: number;
	counted: boolean;
}

export interface Standing {
	playerId: number;
	place: number;
	total: number;
	wins: number;
	bestWeek: number;
	weeks: PlayerWeek[];
}

/**
 * Season standings over the revealed weeks.
 *
 * Each player's season total is the sum of their best `seasonWeeks - voided - DROP_WORST`
 * weeks. Until a player has more weeks than that, every week counts, so the
 * drop only bites at the end of the season. A missed week is worth 0 points.
 *
 * Tiebreakers (most weekly wins, then best single week) use counted weeks only.
 *
 * Pass only weeks past their open phase: including the open week would leak
 * results while people are still playing.
 */
export function seasonStandings(weeks: SeasonWeek[], seasonWeeks: number): Standing[] {
	const active = weeks.filter((w) => !w.voided).sort((a, b) => a.week - b.week);
	const voidedCount = weeks.filter((w) => w.voided).length;
	const countedTarget = Math.max(1, seasonWeeks - voidedCount - DROP_WORST);

	const placements = new Map<number, Map<number, Placement>>();
	const playerIds = new Set<number>();
	for (const w of active) {
		const byPlayer = new Map<number, Placement>();
		for (const p of rankWeek(w.results)) {
			byPlayer.set(p.playerId, p);
			playerIds.add(p.playerId);
		}
		placements.set(w.week, byPlayer);
	}

	const rows = [...playerIds].map((playerId) => {
		const playerWeeks: PlayerWeek[] = active.map((w) => {
			const p = placements.get(w.week)!.get(playerId);
			return { week: w.week, place: p?.place ?? null, points: p?.points ?? 0, counted: true };
		});

		// Drop the lowest-scoring weeks beyond the counted target (earliest first on ties).
		const dropCount = Math.max(0, playerWeeks.length - countedTarget);
		[...playerWeeks]
			.sort((a, b) => a.points - b.points || a.week - b.week)
			.slice(0, dropCount)
			.forEach((w) => (w.counted = false));

		const counted = playerWeeks.filter((w) => w.counted);
		return {
			playerId,
			place: 0,
			total: counted.reduce((s, w) => s + w.points, 0),
			wins: counted.filter((w) => w.place === 1).length,
			bestWeek: Math.max(0, ...counted.map((w) => w.points)),
			weeks: playerWeeks
		};
	});

	const cmp = (a: Standing, b: Standing) =>
		b.total - a.total || b.wins - a.wins || b.bestWeek - a.bestWeek;
	rows.sort(cmp);
	rows.forEach((r, i) => {
		r.place = i > 0 && cmp(rows[i - 1], r) === 0 ? rows[i - 1].place : i + 1;
	});
	return rows;
}
