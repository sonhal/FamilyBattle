/**
 * Inserts a fixed sample puzzle for local testing (no API key needed).
 *
 *   pnpm seed:sample 1      # sample puzzle as week 1
 *   pnpm seed:sample 3      # every puzzle of week 3 (the same sample, shuffled differently)
 */
import { config, season } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db.ts';
import { validatePuzzle, type Puzzle } from '../src/lib/server/puzzle-schema.ts';
import { createRepo } from '../src/lib/server/repo.ts';
import { puzzleCount } from '../src/lib/server/schedule.ts';

if (config.production) {
	console.error('Refusing to seed sample data with NODE_ENV=production.');
	process.exit(1);
}

const week = Number(process.argv[2] ?? 1);

const sample: Puzzle = {
	groups: [
		{ category: 'Fisk', color: 'yellow', words: ['Torsk', 'Laks', 'Sei', 'Makrell'] },
		{ category: 'Planeter', color: 'green', words: ['Mars', 'Venus', 'Jupiter', 'Saturn'] },
		{ category: 'Sjakkbrikker', color: 'blue', words: ['Konge', 'Dronning', 'Tårn', 'Løper'] },
		{ category: '___ball', color: 'purple', words: ['Fot', 'Hånd', 'Snø', 'Volley'] }
	]
};

const problems = validatePuzzle(sample);
if (problems.length) throw new Error(problems.join('; '));

const repo = createRepo(openDatabase(config.databasePath));
for (let slot = 1; slot <= puzzleCount(season, week); slot++) {
	if (repo.puzzle(week, slot)) {
		console.log(`Week ${week} puzzle ${slot} already exists.`);
	} else {
		repo.insertPuzzle(sample, { week, slot });
		console.log(`Inserted the sample as week ${week} puzzle ${slot} into ${config.databasePath}`);
	}
}
