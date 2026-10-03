// All runtime configuration, read once from the environment.
// Kept free of `$app/*` imports so the CLI scripts can use it too.

const env = process.env;

function list(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

export const config = {
	databasePath: env.DATABASE_PATH ?? './data/league.db',

	// Forward-auth headers set by Caddy from Authelia's response.
	userHeader: (env.AUTH_USER_HEADER ?? 'Remote-User').toLowerCase(),
	nameHeader: (env.AUTH_NAME_HEADER ?? 'Remote-Name').toLowerCase(),
	groupsHeader: (env.AUTH_GROUPS_HEADER ?? 'Remote-Groups').toLowerCase(),
	playerGroup: env.PLAYER_GROUP ?? 'familybattle',
	adminGroup: env.ADMIN_GROUP ?? 'familybattle-admin',

	// Optional shared secret the proxy adds to every request (defense in depth).
	proxySecretHeader: (env.PROXY_SECRET_HEADER ?? 'X-Proxy-Secret').toLowerCase(),
	proxySecret: env.PROXY_SECRET || null,

	// Season calendar.
	seasonStart: env.SEASON_START ?? '2026-10-04',
	seasonWeeks: Number(env.SEASON_WEEKS ?? 13),

	// Development helpers, ignored in production.
	production: env.NODE_ENV === 'production',
	devUsers: list(env.DEV_USERS),
	nowOverride: env.NODE_ENV === 'production' ? null : env.NOW_OVERRIDE || null
};

export function now(): Date {
	return config.nowOverride ? new Date(config.nowOverride) : new Date();
}
