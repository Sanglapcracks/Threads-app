import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logger } from '../lib/logger.js';
import { pool, query } from './db.js';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations'
);

async function runMigrations() {
  logger.info(`Looking for migrations in ${migrationsDir}`);

  await query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );

  const appliedRes = await query<{ name: string }>(
    'SELECT name FROM schema_migrations'
  );
  const applied = new Set(appliedRes.rows.map((r) => r.name));

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`Skipping ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

runMigrations()
  .then(() => {
    logger.info('All migrations run successfully');
    process.exit(0);
  })
  .catch((err) => {
    logger.error(`Migration failed ${(err as Error).message}`);
    process.exit(1);
  });