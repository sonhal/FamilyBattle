<script lang="ts">
	import { enhance } from '$app/forms';
	import GroupRow from '#lib/components/GroupRow.svelte';
	import GuessGrid from '#lib/components/GuessGrid.svelte';
	import LocalTime from '#lib/components/LocalTime.svelte';
	import { formatDuration, formatPoints } from '#lib/format.ts';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Uke {data.week} · Ordkampen</title>
</svelte:head>

{#if data.week > 1}
	<nav class="weeks" aria-label="Uker">
		<a href="/uke/{data.week - 1}">← Uke {data.week - 1}</a>
	</nav>
{/if}

<h1>
	Uke {data.week}
	{#if data.voided}<span class="badge">Annullert</span>{/if}
</h1>

{#if data.voided}
	<p class="muted">Denne uken teller ikke i sesongen.</p>
{/if}

<section class="groups">
	{#each data.groups as g (g.category)}
		<GroupRow group={g} />
	{/each}
</section>

<h2>Resultater</h2>
{#if data.ranking.length === 0}
	<p class="muted">Ingen spilte denne uken.</p>
{:else}
	<ol class="ranking">
		{#each data.ranking as row, i (i)}
			<li class:me={row.isMe}>
				<div class="place">{row.place}.</div>
				<div class="who">
					<strong>{row.name}</strong>
					<span class="muted">
						{row.groupsSolved}/4 grupper · {row.mistakes} feil · {formatDuration(row.solveMs)}
					</span>
				</div>
				<div class="points">{formatPoints(row.points)} p</div>
				<div class="grid">
					<GuessGrid grid={row.grid} label="Gjetningene til {row.name}" />
				</div>
			</li>
		{/each}
	</ol>
{/if}

<section class="vote">
	<h2>Var oppgaven dårlig?</h2>
	{#if data.vote.allowed}
		<p class="muted">
			Stem hvis et ord passet i flere grupper eller oppgaven var ødelagt. Du kan endre stemmen til <LocalTime
				iso={data.vote.locksAt}
			/>.
		</p>
		<form method="POST" action="?/vote" use:enhance>
			<button name="vote" value="bad" class:chosen={data.vote.mine === true}>Ja, dårlig</button>
			<button name="vote" value="fine" class:chosen={data.vote.mine === false}>Nei, grei</button>
		</form>
		{#if data.vote.mine !== null}
			<p class="small">Din stemme: {data.vote.mine ? 'dårlig' : 'grei'}.</p>
		{/if}
		{#if form?.message}<p class="error">{form.message}</p>{/if}
	{:else if !data.vote.open}
		<p class="muted">Avstemningen er stengt.</p>
	{:else}
		<p class="muted">Bare de som har spilt uke {data.week} kan stemme.</p>
	{/if}
</section>

<style>
	.weeks {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		margin-bottom: 8px;
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

	.groups {
		display: grid;
		gap: 8px;
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
		grid-template-areas:
			'place who points'
			'place grid grid';
		gap: 4px 8px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.ranking li.me {
		border-color: var(--fg);
	}

	.place {
		grid-area: place;
		font-weight: 800;
		font-size: 1.1rem;
	}

	.who {
		grid-area: who;
		display: flex;
		flex-direction: column;
	}

	.points {
		grid-area: points;
		font-weight: 700;
	}

	.grid {
		grid-area: grid;
		font-size: 0.9rem;
	}

	.vote form {
		display: flex;
		gap: 8px;
	}

	.vote button {
		padding: 10px 16px;
		border-radius: 999px;
		border: 1px solid var(--fg);
		background: transparent;
		color: var(--fg);
		font-weight: 600;
		cursor: pointer;
	}

	.vote button.chosen {
		background: var(--accent);
		color: var(--accent-fg);
	}

	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.small {
		font-size: 0.85rem;
	}

	.error {
		color: #dc2626;
	}
</style>
