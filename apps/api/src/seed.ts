import { loadEnv } from '@vp/config';
import { seedDatabase } from '@vp/db/seed';
import { toAppConfig } from '@vp/env-schema';
import { seedDevelopment } from './seed-development';

seedDevelopment(toAppConfig(loadEnv()), (url) => seedDatabase(url, console.log))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
