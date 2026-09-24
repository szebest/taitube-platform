import {
  realServiceClaims,
  useRealServices,
} from '../../packages/server/adapters/__tests__/contract/real-services';
import { loadEnv } from '../../packages/server/config/src/index';

const env = loadEnv();

useRealServices({
  databaseUrl: env.DATABASE_URL,
  redis: { url: env.REDIS_URL, password: env.REDIS_PASSWORD },
  s3: {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET_RAW,
  },
});

/** A spec here that built PGlite or a double in place of a real subject has proved nothing. */
afterAll(() => {
  if (realServiceClaims() === 0) {
    throw new Error('no contract in this file claimed a real service; it ran against a stand-in');
  }
});
