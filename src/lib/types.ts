// Shapes shared between server views and Svelte components.

export type Color = 'yellow' | 'green' | 'blue' | 'purple';

export interface GroupView {
	category: string;
	color: Color;
	words: string[];
}

export interface BoardView {
	solved: GroupView[];
	remaining: string[];
	mistakes: number;
	mistakesLeft: number;
	finished: boolean;
	/** Unsolved groups, shown only to a player whose attempt has ended. */
	revealed: GroupView[];
	/** Colour grid of the player's own guesses, only after finishing. */
	grid: Color[][] | null;
}
