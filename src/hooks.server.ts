import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { repo } from '#lib/server/index.ts';
import { resolveIdentity } from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';

/**
 * Local development has no Caddy/Authelia in front, so DEV_USERS fakes the
 * headers. Format: "sonhal:admin,anna,bob". Switch user with ?as=anna.
 * Compiled out of production builds via `dev`.
 */
function devHeaders(event: Parameters<Handle>[0]['event']): Headers {
	const users = config.devUsers.map((u) => {
		const [name, role] = u.split(':');
		return { name, admin: role === 'admin' };
	});
	const headers = new Headers(event.request.headers);
	if (users.length === 0) return headers;

	const as = event.url.searchParams.get('as');
	if (as) event.cookies.set('dev_user', as, { path: '/', httpOnly: true, sameSite: 'lax' });
	const chosen = users.find((u) => u.name === (as ?? event.cookies.get('dev_user'))) ?? users[0];

	headers.set(config.userHeader, chosen.name);
	headers.set(config.nameHeader, chosen.name[0].toUpperCase() + chosen.name.slice(1));
	headers.set(config.groupsHeader, chosen.admin ? config.adminGroup : config.playerGroup);
	return headers;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Liveness for Docker's healthcheck and deploy checks. Reveals only the version.
	if (event.url.pathname === '/healthz') {
		return new Response(`ok ${config.version}\n`, {
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
		});
	}

	const headers = dev ? devHeaders(event) : event.request.headers;
	const identity = resolveIdentity(headers, config);

	if (!identity.ok) {
		return new Response(identity.status === 401 ? 'Ikke innlogget.' : 'Du er ikke med i ligaen.', {
			status: identity.status,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	const player = repo.upsertPlayer(identity.user, identity.name);
	event.locals.player = { id: player.id, name: player.displayName, isAdmin: identity.isAdmin };

	const response = await resolve(event);
	// Game pages are per-user and time-sensitive: never cache them anywhere.
	response.headers.set('cache-control', 'private, no-store');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'same-origin');
	return response;
};
