import { timingSafeEqual } from 'node:crypto';

export interface AuthConfig {
	userHeader: string;
	nameHeader: string;
	groupsHeader: string;
	playerGroup: string;
	adminGroup: string;
	proxySecretHeader: string;
	proxySecret: string | null;
}

export type Identity =
	| { ok: true; user: string; name: string; isAdmin: boolean }
	| { ok: false; status: 401 | 403; reason: string };

function safeEqual(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Reads the identity Authelia hands over via Caddy's forward_auth.
 * Fails closed: anything missing or unexpected is rejected.
 *
 * These headers are only trustworthy because the container is reachable
 * solely through Caddy, which overwrites them on every request.
 */
export function resolveIdentity(headers: Headers, cfg: AuthConfig): Identity {
	if (cfg.proxySecret) {
		const presented = headers.get(cfg.proxySecretHeader) ?? '';
		if (!safeEqual(presented, cfg.proxySecret)) {
			return { ok: false, status: 401, reason: 'missing proxy secret' };
		}
	}

	const user = headers.get(cfg.userHeader)?.trim();
	if (!user) return { ok: false, status: 401, reason: 'not authenticated' };

	const groups = (headers.get(cfg.groupsHeader) ?? '')
		.split(',')
		.map((g) => g.trim())
		.filter(Boolean);
	const isAdmin = groups.includes(cfg.adminGroup);
	if (!isAdmin && !groups.includes(cfg.playerGroup)) {
		return { ok: false, status: 403, reason: 'not in the league group' };
	}

	const name = headers.get(cfg.nameHeader)?.trim() || user;
	return { ok: true, user, name: name.slice(0, 40), isAdmin };
}
