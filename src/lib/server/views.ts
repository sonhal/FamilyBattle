import { guessGrid, MAX_MISTAKES, solvedGroupIndices, type AttemptState } from './game';
import type { BoardView } from '../types';
import type { Group } from './puzzle-schema';
import { seededShuffle } from './shuffle';

// Everything sent to the browser while a puzzle is open goes through here.
// The full `groups` array must never be returned while the attempt is running.

export function boardView(groups: Group[], attempt: AttemptState, seed: string): BoardView {
	const solvedIdx = solvedGroupIndices(groups, attempt.guesses);
	const solved = solvedIdx.map((i) => ({ ...groups[i] }));
	const solvedWords = new Set(solved.flatMap((g) => g.words));
	const remaining = seededShuffle(
		groups.flatMap((g) => g.words),
		seed
	).filter((w) => !solvedWords.has(w));
	const finished = attempt.finishedAt !== null;

	return {
		solved,
		remaining,
		mistakes: attempt.mistakes,
		mistakesLeft: Math.max(0, MAX_MISTAKES - attempt.mistakes),
		finished,
		revealed: finished
			? groups.filter((_, i) => !solvedIdx.includes(i)).map((g) => ({ ...g }))
			: [],
		grid: finished ? guessGrid(groups, attempt.guesses) : null
	};
}
