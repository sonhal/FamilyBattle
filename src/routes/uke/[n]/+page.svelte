<script lang="ts">
	import LocalTime from '#lib/components/LocalTime.svelte';
	import { formatPoints } from '#lib/format.ts';

	let { data } = $props();

	type Row = (typeof data.ranking)[number];
	const breakdown = (row: Row) =>
		row.puzzles
			.map((x) => `Oppgave ${x.slot}: ${x.points === null ? '–' : `${formatPoints(x.points)} p`}`)
			.join(' · ');
</script>

<svelte:head>
	<title>Uke {data.week} · Ordkampen</title>
</svelte:head>

<nav class="weeks" aria-label="Uker">
	{#if data.week > 1}<a href="/uke/{data.week - 1}">← Uke {data.week - 1}</a>{/if}
</nav>

<h1>
	Uke {data.week}
	{#if data.live}<span class="badge live">Foreløpig</span>{/if}
	{#if data.voided}<span class="badge">Annullert</span>{/if}
</h1>

{#if data.live}
	<p class="muted">
		Uka er fortsatt åpen. Bare oppgavene du har fullført er med, og bare de som er ferdige med dem.
		Svarene og den endelige listen kommer <LocalTime iso={data.revealsAt} />.
	</p>
{/if}

<ul class="puzzles">
	{#each data.puzzles as p (p.slot)}
		<li>
			{#if p.linked}
				<a href="/uke/{data.week}/{p.slot}">Oppgave {p.slot} · {p.day}</a>
			{:else}
				<span class="muted">Oppgave {p.slot} · {p.day}</span>
			{/if}
			{#if p.voided}<span class="badge">Annullert</span>{/if}
		</li>
	{/each}
</ul>

<h2>Ukens resultat</h2>
{#if data.ranking.length === 0}
	<p class="muted">Ingen spilte denne uken.</p>
{:else}
	<ol class="ranking">
		{#each data.ranking as row, i (i)}
			<li class:me={row.isMe}>
				<div class="place">{row.place}.</div>
				<div class="who">
					<strong>{row.name}</strong>
					<span class="muted">{breakdown(row)}</span>
				</div>
				<div class="points">{formatPoints(row.points)} p</div>
			</li>
		{/each}
	</ol>
{/if}

<p class="muted small">
	Hver oppgave gir plasspoeng. Ukepoengene er snittet over ukens oppgaver, og en oppgave du ikke
	spilte gir 0. <a href="/om">Mer om poengene</a>
</p>

<style>
	.weeks {
		font-size: 0.9rem;
		margin-bottom: 8px;
		min-height: 1em;
	}

	a {
		color: inherit;
	}

	h1 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0 12px;
	}

	h2 {
		margin: 24px 0 8px;
		font-size: 1.15rem;
	}

	.badge {
		font-size: 0.8rem;
		padding: 2px 8px;
		border-radius: 999px;
		background: #dc2626;
		color: #fff;
	}

	.badge.live {
		background: var(--accent);
		color: var(--accent-fg);
	}

	.puzzles {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 6px;
	}

	.puzzles li {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.ranking {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.ranking li {
		display: grid;
		grid-template-columns: 2.2em 1fr auto;
		gap: 4px 8px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.ranking li.me {
		border-color: var(--fg);
	}

	.place {
		font-weight: 800;
		font-size: 1.1rem;
	}

	.who {
		display: flex;
		flex-direction: column;
	}

	.points {
		font-weight: 700;
	}

	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.small {
		margin-top: 16px;
		font-size: 0.85rem;
	}
</style>
