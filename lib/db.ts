import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30,
  max_lifetime: 1800,
});

export default sql;
