import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { TOKENS, bearer, buildTestApp } from './test-app';

describe('apps/api: the raw bucket is the one the environment declares', () => {
  it('presigns an upload against S3_BUCKET_RAW', async () => {
    const config = toAppConfig(
      loadEnv({
        NODE_ENV: 'test',
        ADAPTER_FAMILY: 'in-memory',
        DATABASE_URL: 'postgres://localhost:5432/vp',
        S3_BUCKET_RAW: 'vp-raw',
      })
    );
    const { app } = await buildTestApp({ config });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: bearer(TOKENS.user),
      payload: { filename: 'clip.mp4', sizeBytes: 1024, contentType: 'video/mp4' },
    });
    await app.close();

    expect(res.json().singleUrl).toContain('/vp-raw/');
  });
});
