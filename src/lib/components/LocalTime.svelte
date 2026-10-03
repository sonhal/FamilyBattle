<script lang="ts">
	// Renders a server timestamp in the viewer's own timezone. The server
	// doesn't know that timezone, so the formatted text appears after hydration.
	// Norwegian formatting, the viewer's own timezone.
	let { iso, minusMinute = false }: { iso: string; minusMinute?: boolean } = $props();

	let text = $state('');

	$effect(() => {
		const d = new Date(iso);
		if (minusMinute) d.setMinutes(d.getMinutes() - 1);
		text = d.toLocaleString('nb-NO', {
			weekday: 'long',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	});
</script>

<time datetime={iso}>{text || '…'}</time>
