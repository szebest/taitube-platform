import { loadEnv } from '@vp/config';
import { seedDatabase } from '@vp/db/seed';

/** The seed is a dev user and a READY video: fixtures, which no production database should hold. */
export async function seed(env: Record<string, string | undefined> = process.env): Promise<void> {
  const { NODE_ENV, DATABASE_URL } = loadEnv(env, { exitOnError: false });
  if (NODE_ENV === 'production') {
    throw new Error('[api:seed] refuses NODE_ENV=production: the seed is development fixtures');
  }
  await seedDatabase(DATABASE_URL);
}

if (process.env.NODE_ENV !== 'test') {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[api:seed] Seed failed:', err);
      process.exit(1);
    });
}
