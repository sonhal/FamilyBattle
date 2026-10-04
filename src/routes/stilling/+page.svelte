<script lang="ts">
	import { formatPoints } from '#lib/format.ts';

	let { data } = $props();
</script>

<svelte:head>
	<title>Stilling · Ordkampen</title>
</svelte:head>

<h1>Stilling</h1>

{#if data.liveWeek !== null}
	<p class="muted live-note">
		Inkluderer foreløpige resultater for <a href="/uke/{data.liveWeek}">uke {data.liveWeek}</a>, som
		fortsatt er åpen. Bare de som er ferdige er med, så stillingen kan endre seg.
	</p>
{/if}

{#if data.standings.length === 0}
	<p class="muted">
		Ingen resultater ennå. Stillingen oppdateres når en uke stenger torsdag, eller med en gang du
		har spilt ukens oppgave.
	</p>
{:else}
	<ol class="standings">
		{#each data.standings as row, i (i)}
			<li class:me={row.isMe}>
				<div class="place">{row.place}.</div>
				<div class="who">
					<strong>{row.name}</strong>
					<span class="muted">{row.wins} {row.wins === 1 ? 'seier' : 'seiere'}</span>
				</div>
				<div class="total">{formatPoints(row.total)} p</div>
				<div class="weeks">
					{#each row.weeks as w (w.week)}
						<a
							href="/uke/{w.week}"
							class="chip"
							class:dropped={!w.counted}
							class:missed={w.place === null}
							class:live={w.week === data.liveWeek}
							title="Uke {w.week}{w.week === data.liveWeek ? ' (foreløpig)' : ''}{w.counted
								? ''
								: ' (strøket)'}"
						>
							<span class="wk">U{w.week}{w.week === data.liveWeek ? '*' : ''}</span>
							{formatPoints(w.points)}
						</a>
					{/each}
				</div>
			</li>
		{/each}
	</ol>
{/if}

<section class="rules muted">
	<p>
		Plasspoeng hver uke: 10, 7, 5, 4, 3, 2, 1. Likt resultat deler poengene. En uke du ikke spiller
		gir 0.
	</p>
	<p>
		Bare de {data.countedWeeks} beste ukene av {data.seasonWeeks} teller. Før du har spilt flere uker
		enn det, teller alle. Strøkne uker er gjennomstreket. Ved likt totalt avgjør flest seire, deretter
		beste enkeltuke, blant ukene som teller.
	</p>
	{#if data.weeks.some((w) => w.voided)}
		<p>
			Annullerte uker:
			{data.weeks
				.filter((w) => w.voided)
				.map((w) => w.week)
				.join(', ')}.
		</p>
	{/if}
</section>

{#if data.weeks.length > 0}
	<h2>Uker</h2>
	<ul class="weeklist">
		{#each data.weeks as w (w.week)}
			<li><a href="/uke/{w.week}">Uke {w.week}{w.voided ? ' (annullert)' : ''}</a></li>
		{/each}
	</ul>
{/if}

<style>
	h1 {
		margin: 8px 0 12px;
	}

	h2 {
		font-size: 1.15rem;
		margin: 24px 0 8px;
	}

	.standings {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.standings li {
		display: grid;
		grid-template-columns: 2.2em 1fr auto;
		grid-template-areas:
			'place who total'
			'place weeks weeks';
		gap: 6px 8px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.standings li.me {
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

	.total {
		grid-area: total;
		font-weight: 800;
		font-size: 1.1rem;
	}

	.weeks {
		grid-area: weeks;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.chip {
		display: inline-flex;
		gap: 4px;
		align-items: baseline;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--tile);
		color: var(--fg);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
	}

	.chip .wk {
		color: var(--muted);
		font-weight: 400;
	}

	.chip.missed {
		opacity: 0.7;
	}

	.chip.live {
		outline: 1px dashed var(--muted);
	}

	.live-note a {
		color: inherit;
	}

	.chip.dropped {
		text-decoration: line-through;
		opacity: 0.5;
	}

	.rules {
		margin-top: 16px;
		font-size: 0.85rem;
	}

	.muted {
		color: var(--muted);
	}

	.weeklist {
		padding-left: 20px;
	}

	.weeklist a {
		color: inherit;
	}
</style>
