import { describe, expect, it } from 'vitest';
import { resolveIdentity, type AuthConfig } from './auth';

const cfg: AuthConfig = {
	userHeader: 'remote-user',
	nameHeader: 'remote-name',
	groupsHeader: 'remote-groups',
	playerGroup: 'familybattle',
	adminGroup: 'familybattle-admin',
	proxySecretHeader: 'x-proxy-secret',
	proxySecret: null
};

const h = (init: Record<string, string>) => new Headers(init);

describe('resolveIdentity', () => {
	it('rejects requests without a user header', () => {
		expect(resolveIdentity(h({}), cfg)).toMatchObject({ ok: false, status: 401 });
		expect(resolveIdentity(h({ 'Remote-User': '  ' }), cfg)).toMatchObject({ ok: false });
	});

	it('rejects users outside the league groups', () => {
		const id = resolveIdentity(h({ 'Remote-User': 'bob', 'Remote-Groups': 'admins,dev' }), cfg);
		expect(id).toMatchObject({ ok: false, status: 403 });
	});

	it('accepts players and admins', () => {
		expect(
			resolveIdentity(
				h({ 'Remote-User': 'anna', 'Remote-Name': 'Anna', 'Remote-Groups': 'familybattle' }),
				cfg
			)
		).toEqual({ ok: true, user: 'anna', name: 'Anna', isAdmin: false });
		expect(
			resolveIdentity(h({ 'Remote-User': 'sonhal', 'Remote-Groups': 'x, familybattle-admin' }), cfg)
		).toEqual({ ok: true, user: 'sonhal', name: 'sonhal', isAdmin: true });
	});

	it('does not treat a group name substring as membership', () => {
		const id = resolveIdentity(
			h({ 'Remote-User': 'eve', 'Remote-Groups': 'familybattle-admins' }),
			cfg
		);
		expect(id.ok).toBe(false);
	});

	it('requires the proxy secret when configured', () => {
		const withSecret = { ...cfg, proxySecret: 's3cret' };
		const base = { 'Remote-User': 'anna', 'Remote-Groups': 'familybattle' };
		expect(resolveIdentity(h(base), withSecret)).toMatchObject({ ok: false, status: 401 });
		expect(resolveIdentity(h({ ...base, 'X-Proxy-Secret': 'wrong!' }), withSecret).ok).toBe(false);
		expect(resolveIdentity(h({ ...base, 'X-Proxy-Secret': 's3cret' }), withSecret).ok).toBe(true);
	});
});
