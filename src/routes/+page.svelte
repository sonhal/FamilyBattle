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

	{#if data.state !== 'review' && data.slots.length > 1}
		<nav class="slots" aria-label="Ukens oppgaver">
			{#each data.slots as s (s.slot)}
				{#if s.state === 'upcoming'}
					<span class="slot upcoming">
						<span class="day">{s.day}</span>
						<span class="status">Kommer</span>
					</span>
				{:else}
					<a
						class="slot"
						href="/?oppgave={s.slot}"
						aria-current={s.slot === data.slot ? 'page' : undefined}
					>
						<span class="day">{s.day}</span>
						<span class="status" class:new={s.state === 'new'}>
							{#if s.state === 'new'}Ny{:else if s.state === 'playing'}Påbegynt{:else if s.state === 'finished'}Ferdig
								✓{:else}Mangler{/if}
						</span>
					</a>
				{/if}
			{/each}
		</nav>
	{/if}

	{#if data.state !== 'review' && data.resultsWeek !== null}
		<p class="results-note">
			<a href="/uke/{data.resultsWeek}">Svarene for uke {data.resultsWeek} er klare →</a>
		</p>
	{/if}

	{#if data.state === 'missing'}
		<section class="notice">
			<h1>Ingen oppgave ennå</h1>
			<p>Denne oppgaven er ikke klar. Si fra til admin.</p>
		</section>
	{:else if data.state === 'review'}
		<section class="notice">
			<h1>Uke {data.week} er ferdigspilt</h1>
			<p><a class="primary" href="/uke/{data.week}">Se resultatene</a></p>
			<p><a href="/stilling">Sesongstilling</a></p>
			{#if data.nextOpensAt}
				<p class="small">Neste oppgave åpner <LocalTime iso={data.nextOpensAt} />.</p>
			{/if}
		</section>
	{:else if data.state === 'not_started'}
		<section class="notice">
			<h1>
				Uke {data.week}{#if data.slots.length > 1}, oppgave {data.slot} av {data.slots.length}{/if}
			</h1>
			<p>16 ord, 4 skjulte grupper, 4 feil tillatt. Ett forsøk.</p>
			<p>Åpen til <LocalTime iso={data.closesAt} minusMinute />.</p>
			<p class="small">
				Tiden starter når du trykker Start. Den brukes bare ved likt resultat.
				<a href="/om">Slik spiller du</a>
			</p>
			<form method="POST" action="?/start&oppgave={data.slot}" use:enhance>
				<button class="primary">Start</button>
			</form>
			{#if form?.message}<p class="error">{form.message}</p>{/if}
		</section>
	{:else if data.state === 'playing'}
		<!-- A fresh board per puzzle: local selection and shuffle order belong to one puzzle. -->
		{#key data.slot}
			<Board
				board={data.board}
				{form}
				closesAt={data.closesAt}
				week={data.week}
				slot={data.slot}
				multi={data.slots.length > 1}
			/>
		{/key}
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

	.slots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
		gap: 6px;
		margin-bottom: 12px;
	}

	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 4px;
		border: 1px solid var(--border);
		border-radius: 8px;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.slot[aria-current='page'] {
		border-color: var(--fg);
		font-weight: 700;
	}

	.slot.upcoming {
		color: var(--muted);
		border-style: dashed;
	}

	.slot .status {
		font-size: 0.75rem;
		color: var(--muted);
		font-weight: 400;
	}

	.slot .status.new {
		padding: 0 6px;
		border-radius: 999px;
		background: #dc2626;
		color: #fff;
		font-weight: 700;
	}

	.results-note {
		margin: 0 0 12px;
		font-size: 0.9rem;
		text-align: center;
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
