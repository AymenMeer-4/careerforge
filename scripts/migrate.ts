import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load env vars if needed, though typically Next.js handles this or we run with env loaded
// For a standalone script we might need dotenv, but let's assume DATABASE_URL is available
// or we load it manually from .env.local

import { fileURLToPath } from 'url';

const loadEnv = () => {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  } catch (e) {
    console.log('No .env.local found or error reading it.');
  }
};

async function migrate() {
  loadEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const sql = postgres(connectionString, {
    max: 1,
    ssl: 'require',
    connect_timeout: 60,
    idle_timeout: 20,
  });

  try {
    const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    console.log('Running migrations...');

    // Postgres error codes for objects that already exist — safe to skip when
    // re-running migrations against a DB that was already initialised.
    const DUPLICATE_CODES = new Set(['42P07', '42701', '42710', '42P06', '42723']);

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Applying ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const query = fs.readFileSync(filePath, 'utf8');

        try {
          // Execute the raw SQL migration
          await sql.unsafe(query);
          console.log(`${file} applied successfully.`);
        } catch (err: any) {
          if (DUPLICATE_CODES.has(err?.code)) {
            console.log(`${file} skipped — objects already exist (${err.code}).`);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('All migrations applied.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
