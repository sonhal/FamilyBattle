<script lang="ts">
	import GroupRow from '#lib/components/GroupRow.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Om spillet · Ordkampen</title>
</svelte:head>

<h1>Om spillet</h1>

<section>
	<h2>Slik spiller du</h2>
	<p>
		Hver uke får du 16 ord. De hører sammen i fire skjulte grupper på fire ord. Velg fire ord du
		tror hører sammen, og trykk Send. Treffer du, legger gruppen seg fast med navnet sitt.
	</p>
	<div class="example">
		<GroupRow
			group={{ category: 'Trær', color: 'yellow', words: ['Bjørk', 'Eik', 'Gran', 'Furu'] }}
		/>
		<GroupRow
			group={{ category: '___lys', color: 'purple', words: ['Nord', 'Måne', 'Sol', 'Stearin'] }}
		/>
	</div>
	<p>
		Fargen viser hvor vanskelig gruppen er: <strong>gul</strong> er enklest, så
		<strong>grønn</strong> og <strong>blå</strong>, og <strong>lilla</strong> er den lureste. Pass på
		ord som passer flere steder. Sol og måne kunne vært «ting på himmelen», men her hører de til «___lys».
	</p>
	<ul>
		<li>Du har <strong>4 feil</strong> å gå på. Ved fjerde feil er spillet over.</li>
		<li>«Én unna» betyr at tre av de fire ordene hører sammen.</li>
		<li>Gjetter du det samme to ganger, teller det ikke som feil.</li>
		<li>
			Du har <strong>ett forsøk</strong> per uke. Klokka starter når du trykker Start, og brukes bare
			ved likt resultat.
		</li>
	</ul>
</section>

<section>
	<h2>Uka</h2>
	<dl class="week">
		<dt>Søndag–onsdag</dt>
		<dd>
			Ukens oppgave er åpen. Spill når det passer, frem til onsdag kl. 23.59. Når du er ferdig, ser
			du resultatene og stillingen så langt, oppdatert etter hvert som de andre blir ferdige.
		</dd>
		<dt>Torsdag–lørdag</dt>
		<dd>
			Svarene og ukens endelige resultater vises. Du kan stemme hvis du synes oppgaven var
			urettferdig, og admin kan annullere den.
		</dd>
		<dt>Søndag</dt>
		<dd>Ny oppgave.</dd>
	</dl>
	<p>
		Plassen din avgjøres av antall grupper du fant, så færrest feil, så tiden. Plassene gir
		{data.points.join(', ')} poeng. Likt resultat deler poengene, og en uke du ikke spiller gir 0.
	</p>
</section>

<section>
	<h2>Sesongen</h2>
	<p>
		Sesongen har {data.weeks} uker, fra {data.seasonStart}. Poengene samles i
		<a href="/stilling">stillingen</a>, der dine {data.dropWorst} dårligste uker strykes, så én travel
		uke ødelegger ikke alt.
	</p>
	<p class="finale">
		Siste uke stenger {data.lastPlayDay}.
		{#if data.winnerOnNewYearsEve}
			Spillet avsluttes nyttårsaften, {data.winnerDay}, da de siste resultatene kommer. Sesongens
			vinner kåres under nyttårsmiddagen.
		{:else}
			{data.winnerDay} kommer de siste resultatene, og sesongens vinner kåres.
		{/if}
	</p>
	<p class="muted">Ved likt totalt vinner den med flest ukeseire, deretter beste enkeltuke.</p>
</section>

<style>
	h1 {
		margin: 8px 0 12px;
	}

	h2 {
		font-size: 1.15rem;
		margin: 24px 0 8px;
	}

	p,
	li,
	dd {
		line-height: 1.5;
	}

	ul {
		padding-left: 20px;
	}

	.example {
		display: grid;
		gap: 8px;
		margin: 12px 0;
	}

	.week dt {
		font-weight: 700;
		margin-top: 8px;
	}

	.week dd {
		margin: 2px 0 0;
	}

	.finale {
		font-weight: 600;
	}

	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}

	a {
		color: inherit;
	}
</style>
