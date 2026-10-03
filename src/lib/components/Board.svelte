<script lang="ts">
	import { enhance } from '$app/forms';
	import type { BoardView, Color } from '#lib/types.ts';
	import LocalTime from './LocalTime.svelte';

	type FormResult = { result?: string; message?: string } | null | undefined;

	let { board, form, closesAt }: { board: BoardView; form: FormResult; closesAt: string } =
		$props();

	let selected = $state<string[]>([]);
	let localOrder = $state<string[] | null>(null);
	let submitting = $state(false);

	// Words leave `remaining` as groups are solved; keep local state in sync.
	let tiles = $derived(
		localOrder ? localOrder.filter((w) => board.remaining.includes(w)) : board.remaining
	);
	let picked = $derived(selected.filter((w) => board.remaining.includes(w)));

	const feedback: Record<string, string> = {
		correct: 'Nice!',
		one_away: 'One away…',
		wrong: 'Not quite.',
		already_guessed: 'Already guessed.'
	};

	const emoji: Record<Color, string> = {
		yellow: '🟨',
		green: '🟩',
		blue: '🟦',
		purple: '🟪'
	};

	function toggle(word: string) {
		if (picked.includes(word)) selected = picked.filter((w) => w !== word);
		else if (picked.length < 4) selected = [...picked, word];
	}

	function shuffle() {
		const a = [...tiles];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		localOrder = a;
	}
</script>

{#snippet group(g: { category: string; color: Color; words: string[] })}
	<div class="group" style:background={`var(--${g.color})`}>
		<strong>{g.category}</strong>
		<span>{g.words.join(', ')}</span>
	</div>
{/snippet}

<div class="board">
	{#each board.solved as g (g.category)}
		{@render group(g)}
	{/each}

	{#if !board.finished}
		<div class="grid" role="group" aria-label="Words">
			{#each tiles as word (word)}
				<button
					type="button"
					class="tile"
					class:selected={picked.includes(word)}
					aria-pressed={picked.includes(word)}
					onclick={() => toggle(word)}
				>
					{word}
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if board.finished}
	<section class="done">
		<h2>{board.revealed.length === 0 ? 'Solved!' : 'Out of mistakes'}</h2>
		{#each board.revealed as g (g.category)}
			{@render group(g)}
		{/each}
		{#if board.grid}
			<div class="emoji" aria-label="Your guesses">
				{#each board.grid as row, i (i)}
					<div>{row.map((c) => emoji[c]).join('')}</div>
				{/each}
			</div>
		{/if}
		<p class="muted">
			Results and standings are revealed when play closes, <LocalTime iso={closesAt} />.
		</p>
	</section>
{:else}
	<div class="mistakes">
		Mistakes left:
		{#each { length: 4 } as _, i (i)}
			<span class="dot" class:used={i >= board.mistakesLeft}></span>
		{/each}
	</div>

	<p class="feedback" aria-live="polite">
		{#if form?.message}{form.message}{:else if form?.result}{feedback[form.result]}{/if}
	</p>

	<form
		method="POST"
		action="?/guess"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				submitting = false;
				if (result.type === 'success' && result.data?.result === 'correct') selected = [];
			};
		}}
	>
		{#each picked as word (word)}
			<input type="hidden" name="word" value={word} />
		{/each}
		<div class="actions">
			<button type="button" onclick={shuffle}>Shuffle</button>
			<button type="button" onclick={() => (selected = [])} disabled={picked.length === 0}>
				Deselect all
			</button>
			<button class="primary" disabled={picked.length !== 4 || submitting}>Submit</button>
		</div>
	</form>
{/if}

<style>
	.board {
		display: grid;
		gap: 8px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.tile {
		aspect-ratio: 1 / 0.8;
		min-width: 0;
		padding: 4px;
		border: none;
		border-radius: 8px;
		background: var(--tile);
		color: var(--fg);
		font-weight: 700;
		font-size: clamp(0.62rem, 3.2vw, 0.95rem);
		text-transform: uppercase;
		overflow-wrap: anywhere;
		cursor: pointer;
		transition:
			background 120ms,
			transform 80ms;
	}

	.tile:active {
		transform: scale(0.96);
	}

	.tile.selected {
		background: var(--tile-selected);
		color: var(--tile-selected-fg);
	}

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

	.group strong {
		text-transform: uppercase;
	}

	.group span {
		text-transform: uppercase;
		font-size: 0.85rem;
	}

	.mistakes {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 16px 0 4px;
		color: var(--muted);
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--tile-selected);
	}

	.dot.used {
		background: var(--tile);
	}

	.feedback {
		min-height: 1.4em;
		text-align: center;
		font-weight: 600;
		margin: 4px 0 8px;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.actions button {
		padding: 10px 16px;
		border-radius: 999px;
		border: 1px solid var(--fg);
		background: transparent;
		color: var(--fg);
		font-weight: 600;
		cursor: pointer;
	}

	.actions button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.actions .primary {
		background: var(--accent);
		color: var(--accent-fg);
	}

	.done {
		display: grid;
		gap: 8px;
		margin-top: 8px;
		text-align: center;
	}

	.done h2 {
		margin: 8px 0;
	}

	.emoji {
		font-size: 1.4rem;
		line-height: 1.3;
		margin: 8px 0;
	}

	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
