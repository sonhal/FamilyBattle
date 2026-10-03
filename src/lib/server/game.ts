import { normalizeWord, type Color, type Group } from './puzzle-schema';

export const MAX_MISTAKES = 4;
// Hard cap on submissions per attempt, repeats included.
export const MAX_SUBMISSIONS = 60;

export type Verdict = 'correct' | 'one_away' | 'wrong';

export interface GuessRecord {
	words: string[];
	verdict: Verdict;
	at: string;
}

export interface AttemptState {
	groupsSolved: number;
	mistakes: number;
	guesses: GuessRecord[];
	submissions: number;
	finishedAt: string | null;
}

// `reason` is shown to players, so it is in Norwegian.
export type GuessOutcome =
	| { kind: 'invalid'; reason: string }
	| { kind: 'already_guessed' }
	| { kind: 'scored'; verdict: Verdict; state: AttemptState };

export function guessKey(words: string[]): string {
	return words.map(normalizeWord).sort().join('|');
}

function groupIndexOf(groups: Group[], word: string): number {
	const n = normalizeWord(word);
	return groups.findIndex((g) => g.words.some((w) => normalizeWord(w) === n));
}

export function evaluate(groups: Group[], words: string[]): Verdict {
	const counts = new Map<number, number>();
	for (const w of words) {
		const i = groupIndexOf(groups, w);
		counts.set(i, (counts.get(i) ?? 0) + 1);
	}
	const best = Math.max(...counts.values());
	if (best === 4) return 'correct';
	if (best === 3) return 'one_away';
	return 'wrong';
}

/** Indices of groups the player has solved, in the order they solved them. */
export function solvedGroupIndices(groups: Group[], guesses: GuessRecord[]): number[] {
	return guesses
		.filter((g) => g.verdict === 'correct')
		.map((g) => groupIndexOf(groups, g.words[0]));
}

/**
 * Applies one guess. Pure: the caller persists the returned state.
 * Everything here runs on the server; the client only sends four words.
 */
export function applyGuess(
	groups: Group[],
	state: AttemptState,
	rawWords: unknown[],
	now: Date
): GuessOutcome {
	if (state.finishedAt) return { kind: 'invalid', reason: 'Forsøket er ferdig.' };
	if (state.submissions >= MAX_SUBMISSIONS) {
		return { kind: 'invalid', reason: 'For mange innsendinger.' };
	}

	const words = rawWords.filter((w): w is string => typeof w === 'string');
	if (words.length !== 4 || rawWords.length !== 4) {
		return { kind: 'invalid', reason: 'Velg nøyaktig fire ord.' };
	}
	if (new Set(words.map(normalizeWord)).size !== 4) {
		return { kind: 'invalid', reason: 'Velg fire forskjellige ord.' };
	}

	const solved = new Set(solvedGroupIndices(groups, state.guesses));
	for (const w of words) {
		const i = groupIndexOf(groups, w);
		if (i === -1) return { kind: 'invalid', reason: 'Ukjent ord.' };
		if (solved.has(i)) return { kind: 'invalid', reason: 'Det ordet er allerede løst.' };
	}

	const key = guessKey(words);
	if (state.guesses.some((g) => guessKey(g.words) === key)) {
		return { kind: 'already_guessed' };
	}

	// Store the canonical spelling from the puzzle, not whatever the client sent.
	const canonical = words.map((w) => {
		const g = groups[groupIndexOf(groups, w)];
		return g.words.find((x) => normalizeWord(x) === normalizeWord(w))!;
	});

	const verdict = evaluate(groups, canonical);
	const groupsSolved = state.groupsSolved + (verdict === 'correct' ? 1 : 0);
	const mistakes = state.mistakes + (verdict === 'correct' ? 0 : 1);
	const finished = groupsSolved === groups.length || mistakes >= MAX_MISTAKES;

	return {
		kind: 'scored',
		verdict,
		state: {
			groupsSolved,
			mistakes,
			guesses: [...state.guesses, { words: canonical, verdict, at: now.toISOString() }],
			submissions: state.submissions + 1,
			finishedAt: finished ? now.toISOString() : null
		}
	};
}

/** Colour grid for the share/summary view: one row per guess. */
export function guessGrid(groups: Group[], guesses: GuessRecord[]): Color[][] {
	return guesses.map((g) => g.words.map((w) => groups[groupIndexOf(groups, w)].color));
}
