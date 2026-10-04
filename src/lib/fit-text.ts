// Svelte action: shrink an element's font size until its text fits on one
// line, down to a readable minimum. Below that, the text is allowed to wrap.
// Re-runs when the container is resized (rotation, window resize).

const MIN_PX = 9;

export function fitText(node: HTMLElement) {
	const fit = () => {
		node.style.fontSize = '';
		node.style.whiteSpace = 'nowrap';
		let size = parseFloat(getComputedStyle(node).fontSize);
		while (node.scrollWidth > node.clientWidth && size > MIN_PX) {
			size -= 0.5;
			node.style.fontSize = `${size}px`;
		}
		if (node.scrollWidth > node.clientWidth) node.style.whiteSpace = 'normal';
	};

	fit();
	const observer = new ResizeObserver(fit);
	observer.observe(node.parentElement ?? node);
	return { destroy: () => observer.disconnect() };
}
