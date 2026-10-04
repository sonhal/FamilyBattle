import { error, fail } from '@sveltejs/kit';
import { repo, season } from '#lib/server/index.ts';
import { adminOverview, setWeekVoided } from '#lib/server/admin.ts';
import { now } from '#lib/server/config.ts';
import type { Actions, PageServerLoad } from './$types';

/** Checked in load and again in every action: a form post doesn't go through load. */
function requireAdmin(locals: App.Locals) {
	if (!locals.player.isAdmin) error(403, 'Bare for admin.');
}

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return adminOverview(repo, season, now());
};

async function update(locals: App.Locals, request: Request, voided: boolean) {
	requireAdmin(locals);
	const form = await request.formData();
	const week = Number(form.get('week'));
	const note = form.get('note');
	const result = setWeekVoided(
		repo,
		season,
		now(),
		week,
		voided,
		typeof note === 'string' ? note : null
	);
	if (!result.ok) return fail(400, { week, message: result.message });
	return { week, saved: true };
}

export const actions: Actions = {
	void: ({ locals, request }) => update(locals, request, true),
	restore: ({ locals, request }) => update(locals, request, false)
};
