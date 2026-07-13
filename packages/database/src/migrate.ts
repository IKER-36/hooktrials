import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './index.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations');

const connection = createDatabase(databaseUrl);

try {
  const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));
  await migrate(connection.db, { migrationsFolder });
  process.stdout.write('Database migrations completed.\n');
} finally {
  await connection.close();
}
