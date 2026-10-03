/**
 * Writes a consistent copy of the live database (safe while the app runs).
 *
 *   docker compose run --rm tools backup              # → /data/backups/league-YYYY-MM-DD.db
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db.ts';

const dir = path.join(path.dirname(config.databasePath), 'backups');
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, `league-${new Date().toISOString().slice(0, 10)}.db`);

await openDatabase(config.databasePath).backup(target);
console.log(`Backup written to ${target}`);
