import { describe, expect, it } from 'vitest';
import { applyGuess, evaluate, guessGrid, MAX_SUBMISSIONS, type AttemptState } from './game';
import { cleanPuzzle, validatePuzzle, type Group } from './puzzle-schema';
import { seededShuffle } from './shuffle';

const groups: Group[] = [
	{ category: 'Fish', color: 'yellow', words: ['Bass', 'Pike', 'Sole', 'Carp'] },
	{ category: 'Planets', color: 'green', words: ['Mars', 'Venus', 'Earth', 'Saturn'] },
	{ category: 'Chess pieces', color: 'blue', words: ['King', 'Queen', 'Rook', 'Bishop'] },
	{ category: '___ball', color: 'purple', words: ['Foot', 'Basket', 'Snow', 'Hand'] }
];

const fresh = (): AttemptState => ({
	groupsSolved: 0,
	mistakes: 0,
	guesses: [],
	submissions: 0,
	finishedAt: null
});

const t = new Date('2026-10-04T10:00:00Z');

function play(state: AttemptState, words: string[]) {
	const out = applyGuess(groups, state, words, t);
	if (out.kind !== 'scored') throw new Error(`expected scored, got ${out.kind}`);
	return out;
}

describe('evaluate', () => {
	it('distinguishes correct, one away and wrong', () => {
		expect(evaluate(groups, ['Bass', 'Pike', 'Sole', 'Carp'])).toBe('correct');
		expect(evaluate(groups, ['Bass', 'Pike', 'Sole', 'Mars'])).toBe('one_away');
		expect(evaluate(groups, ['Bass', 'Pike', 'Mars', 'Venus'])).toBe('wrong');
	});
});

describe('applyGuess', () => {
	it('is case-insensitive and stores canonical spelling', () => {
		const out = play(fresh(), [' bass', 'PIKE', 'sole', 'Carp']);
		expect(out.verdict).toBe('correct');
		expect(out.state.groupsSolved).toBe(1);
		expect(out.state.guesses[0].words).toEqual(['Bass', 'Pike', 'Sole', 'Carp']);
	});

	it('treats a repeated set as free, in any order', () => {
		const s = play(fresh(), ['Bass', 'Pike', 'Mars', 'Venus']).state;
		expect(s.mistakes).toBe(1);
		const again = applyGuess(groups, s, ['venus', 'mars', 'pike', 'bass'], t);
		expect(again.kind).toBe('already_guessed');
	});

	it('rejects malformed guesses without cost', () => {
		expect(applyGuess(groups, fresh(), ['Bass', 'Pike', 'Sole'], t).kind).toBe('invalid');
		expect(applyGuess(groups, fresh(), ['Bass', 'Bass', 'Sole', 'Carp'], t).kind).toBe('invalid');
		expect(applyGuess(groups, fresh(), ['Bass', 'Pike', 'Sole', 'Nope'], t).kind).toBe('invalid');
		expect(applyGuess(groups, fresh(), ['Bass', 'Pike', 'Sole', 42], t).kind).toBe('invalid');
	});

	it('rejects words from an already solved group', () => {
		const s = play(fresh(), ['Bass', 'Pike', 'Sole', 'Carp']).state;
		const out = applyGuess(groups, s, ['Bass', 'Mars', 'Venus', 'Earth'], t);
		expect(out.kind).toBe('invalid');
	});

	it('finishes after four mistakes', () => {
		let s = fresh();
		s = play(s, ['Bass', 'Pike', 'Mars', 'Venus']).state;
		s = play(s, ['Bass', 'Pike', 'King', 'Queen']).state;
		s = play(s, ['Bass', 'Pike', 'Foot', 'Snow']).state;
		expect(s.finishedAt).toBeNull();
		s = play(s, ['Mars', 'Venus', 'King', 'Queen']).state;
		expect(s.mistakes).toBe(4);
		expect(s.finishedAt).toBe(t.toISOString());
		expect(applyGuess(groups, s, ['Bass', 'Pike', 'Sole', 'Carp'], t).kind).toBe('invalid');
	});

	it('finishes after solving all four groups', () => {
		let s = fresh();
		for (const g of groups) s = play(s, g.words).state;
		expect(s.groupsSolved).toBe(4);
		expect(s.finishedAt).not.toBeNull();
		expect(guessGrid(groups, s.guesses)).toEqual([
			['yellow', 'yellow', 'yellow', 'yellow'],
			['green', 'green', 'green', 'green'],
			['blue', 'blue', 'blue', 'blue'],
			['purple', 'purple', 'purple', 'purple']
		]);
	});

	it('enforces the submission cap', () => {
		const s = { ...fresh(), submissions: MAX_SUBMISSIONS };
		expect(applyGuess(groups, s, ['Bass', 'Pike', 'Sole', 'Carp'], t).kind).toBe('invalid');
	});
});

describe('validatePuzzle', () => {
	it('accepts a well-formed puzzle', () => {
		expect(validatePuzzle({ groups })).toEqual([]);
	});

	it('catches duplicates, wrong sizes and reused colours', () => {
		const bad = {
			groups: [
				{ ...groups[0], words: ['Bass', 'Pike', 'Sole'] },
				{ ...groups[1], color: 'yellow' as const },
				groups[2],
				{ ...groups[3], words: ['Foot', 'Basket', 'Snow', 'bass'] }
			]
		};
		const errors = validatePuzzle(bad);
		expect(errors.some((e) => e.includes('3 words'))).toBe(true);
		expect(errors.some((e) => e.includes('colour'))).toBe(true);
		expect(errors.some((e) => e.includes('more than once'))).toBe(true);
	});

	it('rejects words and categories used before', () => {
		const errors = validatePuzzle({ groups }, { words: ['SNOW'], categories: ['fish'] });
		expect(errors).toHaveLength(2);
	});

	it('orders groups by difficulty when cleaning', () => {
		const shuffled = { groups: [groups[3], groups[0], groups[2], groups[1]] };
		expect(cleanPuzzle(shuffled).groups.map((g) => g.color)).toEqual([
			'yellow',
			'green',
			'blue',
			'purple'
		]);
	});
});

describe('seededShuffle', () => {
	const words = groups.flatMap((g) => g.words);

	it('is stable for the same seed and differs between players', () => {
		const a = seededShuffle(words, '1:7');
		expect(seededShuffle(words, '1:7')).toEqual(a);
		expect(seededShuffle(words, '2:7')).not.toEqual(a);
		expect([...a].sort()).toEqual([...words].sort());
	});
});
