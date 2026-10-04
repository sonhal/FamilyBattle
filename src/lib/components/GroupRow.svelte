<script lang="ts">
	import type { GroupView } from '#lib/types.ts';

	let { group }: { group: GroupView } = $props();
</script>

<div class="group" style:background={`var(--${group.color})`}>
	<strong>{group.category}</strong>
	<span>{group.words.join(', ')}</span>
</div>

<style>
	.group {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 64px;
		padding: 8px;
		border-radius: 8px;
		color: var(--on-group);
		text-align: center;
	}

	.group strong,
	.group span {
		text-transform: uppercase;
	}

	.group span {
		font-size: 0.85rem;
	}
</style>
