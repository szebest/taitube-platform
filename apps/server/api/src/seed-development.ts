import type { AppConfig } from '@vp/env-schema';

/** The seed is a dev user and a READY video: fixtures, which no production database should hold. */
export async function seedDevelopment(
  config: AppConfig,
  seedDatabase: (url: string) => Promise<void>
): Promise<void> {
  if (config.environment === 'production') {
    throw new Error('[api:seed] refuses NODE_ENV=production: the seed is development fixtures');
  }
  await seedDatabase(config.postgres.url);
}
