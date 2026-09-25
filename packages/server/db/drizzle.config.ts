import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/schema.ts', './src/comments-schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
});
