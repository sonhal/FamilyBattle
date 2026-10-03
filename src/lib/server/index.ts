import { config } from './config';
import { openDatabase } from './db';
import { createRepo } from './repo';

// One connection per process. better-sqlite3 is synchronous, so every
// request handler runs its SQL without interleaving.
export const repo = createRepo(openDatabase(config.databasePath));

export const season = { start: config.seasonStart, weeks: config.seasonWeeks };
