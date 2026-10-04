import { describe, expect, it } from 'vitest';
import { MAX_WORD_LENGTH, validatePuzzle, type Puzzle } from './puzzle-schema';
import { reviewFeedback, reviewPrompt, ReviewSchema } from './puzzle-review';

const puzzle: Puzzle = {
	groups: [
		{ category: 'Fisk', color: 'yellow', words: ['Torsk', 'Laks', 'Sei', 'Makrell'] },
		{ category: 'Planeter', color: 'green', words: ['Mars', 'Venus', 'Jupiter', 'Saturn'] },
		{ category: 'Sjakkbrikker', color: 'blue', words: ['Konge', 'Dronning', 'Tårn', 'Løper'] },
		{ category: '___ball', color: 'purple', words: ['Fot', 'Hånd', 'Snø', 'Volley'] }
	]
};

describe('reviewPrompt', () => {
	it('lists every group and word for the reviewer', () => {
		const p = reviewPrompt(puzzle, 'Norwegian Bokmål');
		for (const g of puzzle.groups) {
			expect(p).toContain(g.category);
			for (const w of g.words) expect(p).toContain(w);
		}
		expect(p).toContain('Norwegian Bokmål');
	});
});

describe('ReviewSchema and reviewFeedback', () => {
	it('accepts an empty review', () => {
		expect(reviewFeedback(ReviewSchema.parse({ issues: [] }))).toEqual([]);
	});

	it('turns issues into generator feedback', () => {
		const review = ReviewSchema.parse({
			issues: [
				{
					word: 'Løper',
					assigned_category: 'Sjakkbrikker',
					also_fits_category: '___ball',
					reason: 'a runner plays ball games'
				}
			]
		});
		const [line] = reviewFeedback(review);
		expect(line).toContain('"Løper"');
		expect(line).toContain('___ball');
	});

	it('rejects malformed reviews', () => {
		expect(() => ReviewSchema.parse({ issues: [{ word: 'x' }] })).toThrow();
		expect(() => ReviewSchema.parse({})).toThrow();
	});
});

describe('word length limit', () => {
	it('is 12 characters so every word fits on a phone tile', () => {
		expect(MAX_WORD_LENGTH).toBe(12);
		const long = {
			groups: puzzle.groups.map((g, i) =>
				i === 0 ? { ...g, words: ['Barnehageplass', ...g.words.slice(1)] } : g
			)
		};
		expect(validatePuzzle(long).some((e) => e.includes('longer than 12'))).toBe(true);
		expect(validatePuzzle(puzzle)).toEqual([]);
	});
});
