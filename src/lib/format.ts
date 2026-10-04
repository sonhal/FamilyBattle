// Small display helpers shared by Svelte components (Norwegian formatting).

export function formatDuration(ms: number | null): string {
	if (ms === null) return '–';
	const total = Math.round(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
	return h ? `${h}:${mmss}` : mmss;
}

export function formatPoints(points: number): string {
	return points.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
}
