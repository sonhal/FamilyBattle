<script lang="ts">
	import { enhance } from '$app/forms';
	import Board from '#lib/components/Board.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';

	let { data, form } = $props();
</script>

{#if data.state === 'before'}
	<section class="notice">
		<h1>The season starts soon</h1>
		<p>Week 1 opens <LocalTime iso={data.opensAt} />.</p>
	</section>
{:else if data.state === 'over'}
	<section class="notice">
		<h1>The season is over</h1>
		<p>Thanks for playing!</p>
	</section>
{:else}
	<div class="meta">
		<span>Week {data.week} of {data.weeks}</span>
		{#if data.state === 'not_started' || data.state === 'playing'}
			<span>{data.playedCount} of {data.playerCount} played</span>
		{/if}
	</div>

	{#if data.state === 'missing'}
		<section class="notice">
			<h1>No puzzle yet</h1>
			<p>This week's puzzle isn't ready. Ping the admin.</p>
		</section>
	{:else if data.state === 'review'}
		<section class="notice">
			<h1>Week {data.week} is closed for play</h1>
			<p>Results are being revealed. The next puzzle opens <LocalTime iso={data.nextOpensAt} />.</p>
		</section>
	{:else if data.state === 'not_started'}
		<section class="notice">
			<h1>Week {data.week}</h1>
			<p>16 words, 4 hidden groups, 4 mistakes allowed. One attempt.</p>
			<p>Open until <LocalTime iso={data.closesAt} minusMinute />.</p>
			<p class="small">Your timer starts when you press Start. It only breaks ties.</p>
			<form method="POST" action="?/start" use:enhance>
				<button class="primary">Start</button>
			</form>
			{#if form?.message}<p class="error">{form.message}</p>{/if}
		</section>
	{:else if data.state === 'playing'}
		<Board board={data.board} {form} closesAt={data.closesAt} />
	{/if}
{/if}

<style>
	.meta {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 0.9rem;
		margin-bottom: 12px;
	}

	.notice {
		text-align: center;
		padding: 24px 0;
	}

	.notice h1 {
		margin: 0 0 12px;
		font-size: 1.5rem;
	}

	.small {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.error {
		color: #dc2626;
	}

	.primary {
		margin-top: 8px;
		padding: 12px 36px;
		border-radius: 999px;
		border: none;
		background: var(--accent);
		color: var(--accent-fg);
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}
</style>
