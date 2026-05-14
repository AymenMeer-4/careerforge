import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Singleton connection to avoid multiple pools in dev
const globalForPostgres = globalThis as unknown as {
  sql: postgres.Sql | undefined;
};

export const sql = globalForPostgres.sql ?? postgres(connectionString);

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.sql = sql;
}
