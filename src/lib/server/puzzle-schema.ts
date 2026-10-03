import { z } from 'zod';

export const COLORS = ['yellow', 'green', 'blue', 'purple'] as const;
export type Color = (typeof COLORS)[number];

export const MAX_WORD_LENGTH = 18;

// Shape only. The structural rules (4x4, uniqueness, one group per colour)
// are checked in validatePuzzle so error messages can be fed back to the model.
export const PuzzleSchema = z.object({
	groups: z.array(
		z.object({
			category: z.string(),
			color: z.enum(COLORS),
			words: z.array(z.string())
		})
	)
});

export type Puzzle = z.infer<typeof PuzzleSchema>;
export type Group = Puzzle['groups'][number];

export function normalizeWord(word: string): string {
	return word.trim().toLowerCase();
}

export interface History {
	words: Iterable<string>;
	categories: Iterable<string>;
}

/** Returns a list of problems; an empty list means the puzzle is valid. */
export function validatePuzzle(puzzle: Puzzle, history?: History): string[] {
	const errors: string[] = [];
	const { groups } = puzzle;

	if (groups.length !== 4) errors.push(`expected 4 groups, got ${groups.length}`);

	const colors = new Set(groups.map((g) => g.color));
	if (colors.size !== groups.length) errors.push('each colour must be used exactly once');

	const seen = new Set<string>();
	for (const g of groups) {
		if (!g.category.trim()) errors.push('a group has an empty category');
		if (g.words.length !== 4) {
			errors.push(`group "${g.category}" has ${g.words.length} words, expected 4`);
		}
		for (const w of g.words) {
			const n = normalizeWord(w);
			if (!n) errors.push(`group "${g.category}" has an empty word`);
			if (w.trim().length > MAX_WORD_LENGTH) {
				errors.push(`"${w}" is longer than ${MAX_WORD_LENGTH} characters`);
			}
			if (seen.has(n)) errors.push(`"${w}" appears more than once`);
			seen.add(n);
		}
	}

	if (history) {
		const oldWords = new Set([...history.words].map(normalizeWord));
		const oldCategories = new Set([...history.categories].map(normalizeWord));
		for (const g of groups) {
			if (oldCategories.has(normalizeWord(g.category))) {
				errors.push(`category "${g.category}" was used in an earlier puzzle`);
			}
			for (const w of g.words) {
				if (oldWords.has(normalizeWord(w))) {
					errors.push(`"${w}" was used in an earlier puzzle`);
				}
			}
		}
	}

	return errors;
}

/** Trims whitespace and orders groups yellow → purple. */
export function cleanPuzzle(puzzle: Puzzle): Puzzle {
	return {
		groups: [...puzzle.groups]
			.map((g) => ({
				category: g.category.trim(),
				color: g.color,
				words: g.words.map((w) => w.trim())
			}))
			.sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color))
	};
}
