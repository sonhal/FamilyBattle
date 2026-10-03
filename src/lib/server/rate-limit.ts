// Small in-memory sliding window. One process, a handful of players: no need
// for anything shared. Resets on restart, which is fine.

export function createRateLimiter(max: number, windowMs: number) {
	const hits = new Map<string, number[]>();
	return (key: string, now = Date.now()): boolean => {
		const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
		if (recent.length >= max) {
			hits.set(key, recent);
			return false;
		}
		recent.push(now);
		hits.set(key, recent);
		return true;
	};
}
