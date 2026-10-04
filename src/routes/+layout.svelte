<script lang="ts">
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Authelia guards every path, so the manifest must be fetched with cookies. -->
	<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<meta name="theme-color" content="#1f2937" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Ordkampen" />
	<title>Ordkampen</title>
</svelte:head>

<header>
	<a class="brand" href="/">Ordkampen</a>
	<nav>
		<a href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Spill</a>
		<a href="/stilling" aria-current={page.url.pathname === '/stilling' ? 'page' : undefined}
			>Stilling</a
		>
		<a href="/om" aria-current={page.url.pathname === '/om' ? 'page' : undefined}>Om</a>
		{#if data.player.isAdmin}
			<a href="/admin" aria-current={page.url.pathname === '/admin' ? 'page' : undefined}>Admin</a>
		{/if}
	</nav>
	<span class="who">{data.player.name}</span>
</header>

<main>
	{@render children()}
</main>

<style>
	:global(:root) {
		--bg: #f7f7f5;
		--fg: #1f2937;
		--muted: #6b7280;
		--tile: #e7e5df;
		--tile-selected: #5a594e;
		--tile-selected-fg: #ffffff;
		--accent: #1f2937;
		--accent-fg: #ffffff;
		--border: #d6d3cb;
		--yellow: #f9df6d;
		--green: #a0c35a;
		--blue: #b0c4ef;
		--purple: #ba81c5;
		--on-group: #1f2937;
		color-scheme: light;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) {
			--bg: #121212;
			--fg: #f3f4f6;
			--muted: #9ca3af;
			--tile: #2b2b2b;
			--tile-selected: #e5e7eb;
			--tile-selected-fg: #111827;
			--accent: #f3f4f6;
			--accent-fg: #111827;
			--border: #3f3f46;
			color-scheme: dark;
		}
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--fg);
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			sans-serif;
		-webkit-tap-highlight-color: transparent;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		row-gap: 4px;
		justify-content: space-between;
		align-items: baseline;
		max-width: 560px;
		margin: 0 auto;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}

	.brand {
		font-weight: 800;
		font-size: 1.15rem;
		color: inherit;
		text-decoration: none;
	}

	nav {
		display: flex;
		gap: 12px;
		margin-left: auto;
		margin-right: 12px;
	}

	nav a {
		color: var(--muted);
		text-decoration: none;
		font-size: 0.95rem;
	}

	nav a[aria-current='page'] {
		color: var(--fg);
		font-weight: 700;
	}

	.who {
		color: var(--muted);
		font-size: 0.9rem;
	}

	main {
		max-width: 560px;
		margin: 0 auto;
		padding: 16px;
	}
</style>
