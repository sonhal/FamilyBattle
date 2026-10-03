/**
 * Runs one SQL statement against the league database, for hand fixes.
 * The runtime image has no sqlite3 CLI, so use this via the tools container:
 *
 *   docker compose run --rm tools sql "SELECT id, week, status FROM puzzles"
 *   docker compose run --rm tools sql "UPDATE puzzles SET status = 'voided' WHERE week = 3"
 */
import { config } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db.ts';

const statement = process.argv.slice(2).join(' ').trim();
if (!statement) {
	console.error('Usage: pnpm sql "<SQL statement>"');
	process.exit(1);
}

const db = openDatabase(config.databasePath);
const stmt = db.prepare(statement);
if (stmt.reader) {
	console.table(stmt.all());
} else {
	const info = stmt.run();
	console.log(`${info.changes} row(s) changed`);
}
