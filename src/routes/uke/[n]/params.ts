import { error } from '@sveltejs/kit';
import { season } from '#lib/server/index.ts';
import { puzzleCount } from '#lib/server/schedule.ts';

export function parseWeek(param: string): number {
	const week = Number(param);
	if (!Number.isInteger(week) || week < 1 || week > season.weeks) error(404, 'Ukjent uke.');
	return week;
}

export function parseSlot(week: number, param: string): number {
	const slot = Number(param);
	if (!Number.isInteger(slot) || slot < 1 || slot > puzzleCount(season, week)) {
		error(404, 'Ukjent oppgave.');
	}
	return slot;
}
