<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const phaseLabel: Record<string, string> = {
		upcoming: 'Kommer',
		open: 'Åpen',
		review: 'Resultater',
		closed: 'Stengt'
	};
</script>

<svelte:head>
	<title>Admin · Ordkampen</title>
</svelte:head>

<h1>Admin</h1>
<p class="muted">
	Oppgavene vises aldri her, så du kan spille selv. Annuller når et flertall har stemt «dårlig».
	Reserveoppgaver: {data.reserves}.
</p>

<ol class="weeks">
	{#each data.weeks as w (w.week)}
		<li class:voided={w.status === 'voided'}>
			<div class="head">
				<strong>Uke {w.week}</strong>
				<span class="phase">{phaseLabel[w.phase]}</span>
				{#if !w.hasPuzzle}
					<span class="warn">Mangler oppgave</span>
				{:else if w.status === 'voided'}
					<span class="badge">Annullert</span>
				{/if}
			</div>

			{#if w.hasPuzzle && w.phase !== 'upcoming'}
				<div class="stats">
					{w.played} har spilt · {w.votesBad} av {w.votesBad + w.votesFine} stemte «dårlig»
				</div>
			{/if}

			{#if w.status === 'voided'}
				{#if w.voidNote}<div class="note">Begrunnelse: {w.voidNote}</div>{/if}
				<form method="POST" action="?/restore" use:enhance>
					<input type="hidden" name="week" value={w.week} />
					<button>Gjenopprett</button>
				</form>
			{:else if w.canVoid}
				<form method="POST" action="?/void" use:enhance>
					<input type="hidden" name="week" value={w.week} />
					<input
						name="note"
						maxlength="500"
						required
						placeholder="Begrunnelse, f.eks. «Løper passet i to grupper»"
						aria-label="Begrunnelse for uke {w.week}"
					/>
					<button class="danger">Annuller</button>
				</form>
			{/if}

			{#if form?.week === w.week && form?.message}
				<p class="error">{form.message}</p>
			{/if}
		</li>
	{/each}
</ol>

<style>
	h1 {
		margin: 8px 0;
	}

	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.weeks {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 8px;
	}

	.weeks li {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		display: grid;
		gap: 6px;
	}

	.weeks li.voided {
		opacity: 0.8;
	}

	.head {
		display: flex;
		gap: 8px;
		align-items: baseline;
		flex-wrap: wrap;
	}

	.phase,
	.stats,
	.note {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.badge,
	.warn {
		font-size: 0.75rem;
		padding: 1px 8px;
		border-radius: 999px;
		color: #fff;
	}

	.badge {
		background: #dc2626;
	}

	.warn {
		background: #b45309;
	}

	form {
		display: flex;
		gap: 6px;
	}

	input[name='note'] {
		flex: 1;
		min-width: 0;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--fg);
	}

	button {
		padding: 8px 14px;
		border-radius: 999px;
		border: 1px solid var(--fg);
		background: transparent;
		color: var(--fg);
		font-weight: 600;
		cursor: pointer;
	}

	button.danger {
		border-color: #dc2626;
		color: #dc2626;
	}

	.error {
		color: #dc2626;
		margin: 0;
	}
</style>
