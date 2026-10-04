<script lang="ts">
	import { enhance } from '$app/forms';
	import Board from '#lib/components/Board.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';

	let { data, form } = $props();
</script>

{#if data.state === 'before'}
	<section class="notice">
		<h1>Sesongen starter snart</h1>
		<p>Uke 1 åpner <LocalTime iso={data.opensAt} />.</p>
	</section>
{:else if data.state === 'over'}
	<section class="notice">
		<h1>Sesongen er over</h1>
		<p>Takk for at du spilte!</p>
	</section>
{:else}
	<div class="meta">
		<span>Uke {data.week} av {data.weeks}</span>
		{#if data.state === 'not_started' || data.state === 'playing'}
			<span>{data.playedCount} av {data.playerCount} har spilt</span>
		{/if}
	</div>

	{#if data.state === 'missing'}
		<section class="notice">
			<h1>Ingen oppgave ennå</h1>
			<p>Ukens oppgave er ikke klar. Si fra til admin.</p>
		</section>
	{:else if data.state === 'review'}
		<section class="notice">
			<h1>Uke {data.week} er ferdigspilt</h1>
			<p><a class="primary" href="/uke/{data.week}">Se resultatene</a></p>
			<p><a href="/stilling">Sesongstilling</a></p>
			<p class="small">Neste oppgave åpner <LocalTime iso={data.nextOpensAt} />.</p>
		</section>
	{:else if data.state === 'not_started'}
		<section class="notice">
			<h1>Uke {data.week}</h1>
			<p>16 ord, 4 skjulte grupper, 4 feil tillatt. Ett forsøk.</p>
			<p>Åpen til <LocalTime iso={data.closesAt} minusMinute />.</p>
			<p class="small">
				Tiden starter når du trykker Start. Den brukes bare ved likt resultat.
				<a href="/om">Slik spiller du</a>
			</p>
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

	a.primary {
		display: inline-block;
		text-decoration: none;
	}

	a {
		color: inherit;
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
