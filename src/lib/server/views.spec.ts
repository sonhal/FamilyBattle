import { describe, expect, it } from 'vitest';
import { applyGuess, type AttemptState } from './game';
import type { Group } from './puzzle-schema';
import { boardView } from './views';

const groups: Group[] = [
	{ category: 'Fish', color: 'yellow', words: ['Bass', 'Pike', 'Sole', 'Carp'] },
	{ category: 'Planets', color: 'green', words: ['Mars', 'Venus', 'Earth', 'Saturn'] },
	{ category: 'Chess pieces', color: 'blue', words: ['King', 'Queen', 'Rook', 'Bishop'] },
	{ category: '___ball', color: 'purple', words: ['Foot', 'Basket', 'Snow', 'Hand'] }
];

const fresh: AttemptState = {
	groupsSolved: 0,
	mistakes: 0,
	guesses: [],
	submissions: 0,
	finishedAt: null
};

const t = new Date('2026-10-04T10:00:00Z');

function step(s: AttemptState, words: string[]): AttemptState {
	const out = applyGuess(groups, s, words, t);
	if (out.kind !== 'scored') throw new Error(out.kind);
	return out.state;
}

describe('boardView', () => {
	it('leaks no unsolved category while the attempt is running', () => {
		let s = step(fresh, ['Bass', 'Pike', 'Sole', 'Carp']);
		s = step(s, ['Mars', 'Venus', 'King', 'Queen']);
		const view = boardView(groups, s, '1:1');
		const json = JSON.stringify(view);

		expect(view.solved.map((g) => g.category)).toEqual(['Fish']);
		expect(view.remaining).toHaveLength(12);
		expect(view.revealed).toEqual([]);
		expect(view.grid).toBeNull();
		for (const hidden of ['Planets', 'Chess pieces', '___ball', 'green', 'blue', 'purple']) {
			expect(json).not.toContain(hidden);
		}
	});

	it('reveals the rest to a player who ran out of mistakes', () => {
		let s = fresh;
		s = step(s, ['Bass', 'Pike', 'Mars', 'Venus']);
		s = step(s, ['Bass', 'Pike', 'King', 'Queen']);
		s = step(s, ['Bass', 'Pike', 'Foot', 'Snow']);
		s = step(s, ['Mars', 'Venus', 'King', 'Queen']);
		const view = boardView(groups, s, '1:1');
		expect(view.finished).toBe(true);
		expect(view.mistakesLeft).toBe(0);
		expect(view.revealed).toHaveLength(4);
		expect(view.grid).toHaveLength(4);
	});
});
