/**
 * Inserts a fixed sample puzzle for local testing (no API key needed).
 *
 *   pnpm seed:sample 1      # sample puzzle as week 1
 */
import { config } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db.ts';
import { validatePuzzle, type Puzzle } from '../src/lib/server/puzzle-schema.ts';
import { createRepo } from '../src/lib/server/repo.ts';

if (config.production) {
	console.error('Refusing to seed sample data with NODE_ENV=production.');
	process.exit(1);
}

const week = Number(process.argv[2] ?? 1);

const sample: Puzzle = {
	groups: [
		{ category: 'Fish', color: 'yellow', words: ['Bass', 'Pike', 'Sole', 'Carp'] },
		{ category: 'Planets', color: 'green', words: ['Mars', 'Venus', 'Earth', 'Saturn'] },
		{ category: 'Chess pieces', color: 'blue', words: ['King', 'Queen', 'Rook', 'Bishop'] },
		{ category: '___ball', color: 'purple', words: ['Foot', 'Basket', 'Snow', 'Hand'] }
	]
};

const problems = validatePuzzle(sample);
if (problems.length) throw new Error(problems.join('; '));

const repo = createRepo(openDatabase(config.databasePath));
if (repo.puzzleForWeek(week)) {
	console.log(`Week ${week} already has a puzzle.`);
} else {
	repo.insertPuzzle(week, sample);
	console.log(`Inserted sample puzzle as week ${week} into ${config.databasePath}`);
}
