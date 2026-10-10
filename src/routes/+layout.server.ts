import { config, now } from '#lib/server/config.ts';
import { repo, season } from '#lib/server/index.ts';
import { unstartedCount } from '#lib/server/play.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	player: locals.player,
	version: config.version,
	// Open puzzles the player hasn't started; shown as a badge on "Spill".
	unstarted: unstartedCount(repo, season, now(), locals.player.id)
});
