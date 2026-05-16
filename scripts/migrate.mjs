/**
 * scripts/migrate.mjs — node-runnable migration runner.
 *
 * Mirrors scripts/migrate.ts but runs without a TS loader:
 *   node --env-file=.env.local scripts/migrate.mjs
 *
 * Applies every db/migrations/*.sql in sorted order. Migrations use
 * `IF NOT EXISTS`, and duplicate-object errors are skipped, so it is idempotent.
 */
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  connect_timeout: 60,
  idle_timeout: 20,
});

const DUPLICATE_CODES = new Set(['42P07', '42701', '42710', '42P06', '42723']);

async function main() {
  const dir = path.resolve(process.cwd(), 'db/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const query = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await sql.unsafe(query);
      console.log(`  ${file} applied.`);
    } catch (err) {
      if (DUPLICATE_CODES.has(err?.code)) {
        console.log(`  ${file} skipped — objects already exist (${err.code}).`);
      } else {
        throw err;
      }
    }
  }
  console.log('All migrations applied.');
  await sql.end();
}

main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
