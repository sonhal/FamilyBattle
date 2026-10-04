/**
 * Generates puzzles with the Claude API and stores them in the database.
 *
 *   pnpm generate --weeks 1-13 --reserves 2
 *   pnpm generate --replace 5          # regenerate week 5 (only if nobody has played it)
 *   pnpm generate --weeks 1-3 --dry-run
 *
 * Idempotent: weeks that already have a puzzle are skipped, so a failed run
 * can simply be repeated. Needs ANTHROPIC_API_KEY in the environment.
 *
 * Each puzzle that passes validation gets an independent review (a separate
 * Claude call that only sees the finished groups and flags words that could
 * belong to another group). Flagged puzzles are sent back for another try.
 *
 * Whoever runs this can see the answers. Pass --quiet to print only status;
 * rejection reasons are hidden too, since they quote puzzle words.
 */
import Anthropic from '@anthropic-ai/sdk';
import { parseArgs } from 'node:util';
import { config } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db.ts';
import {
	cleanPuzzle,
	MAX_WORD_LENGTH,
	PuzzleSchema,
	validatePuzzle,
	type Puzzle
} from '../src/lib/server/puzzle-schema.ts';
import { createRepo } from '../src/lib/server/repo.ts';
import {
	REVIEW_OUTPUT_SCHEMA,
	reviewFeedback,
	reviewPrompt,
	ReviewSchema
} from '../src/lib/server/puzzle-review.ts';

const MODEL = 'claude-opus-5-5';
const MAX_TRIES = 4;

const { values: args } = parseArgs({
	options: {
		weeks: { type: 'string' },
		reserves: { type: 'string', default: '0' },
		replace: { type: 'string' },
		force: { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false },
		quiet: { type: 'boolean', default: false },
		language: { type: 'string', default: process.env.PUZZLE_LANGUAGE ?? 'Norwegian Bokmål' },
		audience: {
			type: 'string',
			default:
				process.env.PUZZLE_AUDIENCE ??
				'a Norwegian family of mixed ages. Cultural references should be Norwegian or widely known in Norway, not American.'
		}
	}
});

// JSON schema for structured output. Lengths are checked by validatePuzzle,
// whose error messages are fed back to the model on retry.
const OUTPUT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['groups'],
	properties: {
		groups: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['category', 'color', 'words'],
				properties: {
					category: { type: 'string' },
					color: { type: 'string', enum: ['yellow', 'green', 'blue', 'purple'] },
					words: { type: 'array', items: { type: 'string' } }
				}
			}
		}
	}
};

function parseRange(spec: string): number[] {
	const out: number[] = [];
	for (const part of spec.split(',')) {
		const [a, b] = part.split('-').map(Number);
		for (let w = a; w <= (b ?? a); w++) out.push(w);
	}
	if (out.some((w) => !Number.isInteger(w) || w < 1)) throw new Error(`bad --weeks: ${spec}`);
	return out;
}

function prompt(history: { words: string[]; categories: string[]; voidNotes: string[] }) {
	return `Create one puzzle in the style of the NYT game "Connections" for ${args.audience}

Rules:
- Everything the players see is in ${args.language}: all 16 words and all 4 category names.
  Use standard spelling (as in Språkrådet's dictionaries), including æ, ø and å where they belong.
- Exactly 16 words or short phrases of at most ${MAX_WORD_LENGTH} characters each (they must fit
  on a phone tile, so avoid long compound words), split into exactly 4 groups of 4.
- Each group has a short category name and a difficulty colour, each colour used once:
  yellow = most straightforward, green = moderate, blue = harder, purple = trickiest
  (wordplay such as hidden words, homophones, compound words like "___hus" or "sol___",
  anagrams). The wordplay must work in ${args.language}, not only in translation.
- Include deliberate red herrings: several words should look like they belong to another
  group. But every word must fit exactly one group once the categories are known. If a
  word could reasonably belong to two groups, replace it.
- Categories must be specific enough that, after the reveal, nobody can argue a word fits
  elsewhere. Avoid vague categories like "Things that are red".
- Use common words an adult would know. No proper names that need specialist knowledge,
  nothing offensive. Words are shown in capitals, so do not rely on capitalisation.
- Before answering, check every word against every other category and fix any ambiguity.

Do not reuse any of these earlier categories: ${history.categories.join('; ') || '(none yet)'}
Do not reuse any of these earlier words: ${history.words.join(', ') || '(none yet)'}
${
	history.voidNotes.length
		? `Earlier puzzles were voided by the players for these reasons. Avoid repeating them:\n${history.voidNotes.map((n) => `- ${n}`).join('\n')}`
		: ''
}`;
}

function extractJson(text: string): unknown {
	const stripped = text
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/```\s*$/, '');
	return JSON.parse(stripped);
}

/** Text of a response, or an error for refusals and truncated output. */
function responseText(response: Anthropic.Beta.BetaMessage): string {
	if (response.stop_reason === 'refusal') {
		throw new Error(`model declined: ${JSON.stringify(response.stop_details)}`);
	}
	if (response.stop_reason === 'max_tokens') throw new Error('response was cut off');
	return response.content
		.filter((b) => b.type === 'text')
		.map((b) => b.text)
		.join('');
}

/**
 * Independent second pass: a fresh conversation that only sees the finished
 * puzzle and reports words that could belong to another group.
 */
async function reviewOne(client: Anthropic, puzzle: Puzzle): Promise<string[]> {
	const response = await client.beta.messages
		.stream({
			model: MODEL,
			max_tokens: 64000,
			thinking: { type: 'adaptive' },
			output_config: {
				effort: 'high',
				format: { type: 'json_schema', schema: REVIEW_OUTPUT_SCHEMA }
			},
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			messages: [{ role: 'user', content: reviewPrompt(puzzle, args.language!) }]
		})
		.finalMessage();
	return reviewFeedback(ReviewSchema.parse(extractJson(responseText(response))));
}

/** Prints problems, or only their count in --quiet mode (they contain puzzle words). */
function report(attempt: number, problems: string[]) {
	console.error(
		args.quiet
			? `  try ${attempt} rejected (${problems.length} problem(s), hidden by --quiet)`
			: `  try ${attempt} rejected: ${problems.join('; ')}`
	);
}

async function generateOne(
	client: Anthropic,
	history: { words: string[]; categories: string[]; voidNotes: string[] }
): Promise<Puzzle> {
	const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt(history) }];

	for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
		const response = await client.beta.messages
			.stream({
				model: MODEL,
				max_tokens: 64000,
				thinking: { type: 'adaptive' },
				output_config: {
					effort: 'high',
					format: { type: 'json_schema', schema: OUTPUT_SCHEMA }
				},
				// Server-side fallback if a safety classifier declines the request.
				betas: ['server-side-fallback-2026-07-01'],
				fallbacks: 'default',
				messages
			})
			.finalMessage();

		if (response.stop_reason === 'refusal') {
			throw new Error(`model declined: ${JSON.stringify(response.stop_details)}`);
		}

		// Model output is untrusted input: parse strictly, then validate.
		let problems: string[];
		let puzzle: Puzzle | null = null;
		try {
			puzzle = cleanPuzzle(PuzzleSchema.parse(extractJson(responseText(response))));
			problems = validatePuzzle(puzzle, history);
		} catch (err) {
			problems = [`could not parse the JSON: ${(err as Error).message}`];
		}

		// Only a structurally valid puzzle is worth the second-pass review.
		if (puzzle && problems.length === 0) {
			problems = await reviewOne(client, puzzle);
			if (problems.length === 0) return puzzle;
		}

		report(attempt, problems);
		messages.push(
			{ role: 'assistant', content: response.content },
			{
				role: 'user',
				content: `That puzzle has problems:\n- ${problems.join('\n- ')}\nPlease produce a corrected puzzle.`
			}
		);
	}
	throw new Error(`no valid puzzle after ${MAX_TRIES} tries`);
}

async function main() {
	const repo = createRepo(openDatabase(config.databasePath));
	const client = new Anthropic();

	const puzzles = repo.allPuzzles();
	const history = {
		words: puzzles.flatMap((p) => p.groups.flatMap((g) => g.words)),
		categories: puzzles.flatMap((p) => p.groups.map((g) => g.category)),
		voidNotes: puzzles.filter((p) => p.voidNote).map((p) => p.voidNote!)
	};

	// Slots to fill: numbered weeks, then reserves (week = null).
	const slots: (number | null)[] = [];

	if (args.replace) {
		const week = Number(args.replace);
		const existing = repo.puzzleForWeek(week);
		if (existing) {
			const played = repo.countAttempts(existing.id);
			if (played > 0 && !args.force) {
				throw new Error(`week ${week} has ${played} attempt(s); pass --force to replace anyway`);
			}
			if (!args['dry-run']) {
				repo.db.transaction(() => {
					repo.db.prepare('DELETE FROM attempts WHERE puzzle_id = ?').run(existing.id);
					repo.db.prepare('DELETE FROM puzzle_votes WHERE puzzle_id = ?').run(existing.id);
					repo.deletePuzzle(existing.id);
				})();
			}
		}
		slots.push(week);
	}

	for (const week of args.weeks ? parseRange(args.weeks) : []) {
		if (repo.puzzleForWeek(week)) {
			console.log(`Week ${week}: already has a puzzle, skipping`);
			continue;
		}
		slots.push(week);
	}
	for (let i = 0; i < Number(args.reserves); i++) slots.push(null);

	if (slots.length === 0) {
		console.log('Nothing to do. Use --weeks, --reserves or --replace.');
		return;
	}

	for (const week of slots) {
		const label = week === null ? 'Reserve' : `Week ${week}`;
		console.log(`${label}: generating…`);
		const puzzle = await generateOne(client, history);

		history.words.push(...puzzle.groups.flatMap((g) => g.words));
		history.categories.push(...puzzle.groups.map((g) => g.category));

		if (!args.quiet) {
			for (const g of puzzle.groups) {
				console.log(`  ${g.color.padEnd(6)} ${g.category}: ${g.words.join(', ')}`);
			}
		}
		if (args['dry-run']) {
			console.log(`${label}: OK (dry run, not saved)`);
		} else {
			repo.insertPuzzle(week, puzzle);
			console.log(`${label}: saved`);
		}
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
