<script lang="ts">
	import type { Color } from '#lib/types.ts';

	let { grid, label }: { grid: Color[][]; label: string } = $props();

	const emoji: Record<Color, string> = {
		yellow: '🟨',
		green: '🟩',
		blue: '🟦',
		purple: '🟪'
	};
</script>

<div class="emoji" role="img" aria-label={label}>
	{#each grid as row, i (i)}
		<div>{row.map((c) => emoji[c]).join('')}</div>
	{/each}
</div>

<style>
	.emoji {
		line-height: 1.25;
	}
</style>
