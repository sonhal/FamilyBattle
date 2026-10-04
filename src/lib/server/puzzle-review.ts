import { z } from 'zod';
import type { Puzzle } from './puzzle-schema';

// Second, independent pass over a generated puzzle: a separate model call that
// only sees the finished groups and looks for words that a reasonable player
// could argue belong to another group. Flagged puzzles go back to the generator.

export const ReviewSchema = z.object({
	issues: z.array(
		z.object({
			word: z.string(),
			assigned_category: z.string(),
			also_fits_category: z.string(),
			reason: z.string()
		})
	)
});

export type Review = z.infer<typeof ReviewSchema>;

/** JSON schema for structured output (strict: no extra properties). */
export const REVIEW_OUTPUT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['issues'],
	properties: {
		issues: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['word', 'assigned_category', 'also_fits_category', 'reason'],
				properties: {
					word: { type: 'string' },
					assigned_category: { type: 'string' },
					also_fits_category: { type: 'string' },
					reason: { type: 'string' }
				}
			}
		}
	}
};

export function reviewPrompt(puzzle: Puzzle, language: string): string {
	const groups = puzzle.groups
		.map((g) => `- ${g.category} (${g.color}): ${g.words.join(', ')}`)
		.join('\n');
	return `You are a strict but fair reviewer of word puzzles in the style of the NYT game
"Connections". The puzzle is in ${language}. Players see the 16 words shuffled and must
sort them into these four groups, judged only by the category names revealed afterwards:

${groups}

Check every word against every OTHER category. Report a word only when a reasonable
adult player could convincingly argue that it fits another category as well as, or
better than, its own. Do not report far-fetched or very loose associations: red herrings
that merely look related before the reveal are intended. Also report a word if it does
not actually fit its own category, or is misspelled in ${language}.

Return an empty issues list when the puzzle is fair.`;
}

/** Turns review issues into feedback for the generator's next attempt. */
export function reviewFeedback(review: Review): string[] {
	return review.issues.map(
		(i) =>
			`a reviewer found that "${i.word}" (in "${i.assigned_category}") could also belong to "${i.also_fits_category}": ${i.reason}`
	);
}
