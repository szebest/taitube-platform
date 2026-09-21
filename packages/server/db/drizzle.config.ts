import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL_MIGRATIONS ||
      process.env.DATABASE_URL ||
      'postgres://vp:vp@localhost:5432/vp',
  },
  strict: true,
  verbose: true,
});
