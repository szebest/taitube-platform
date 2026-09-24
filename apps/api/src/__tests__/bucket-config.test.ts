import { loadEnv } from '@vp/config';
import { mintToken } from '@vp/dev-token';
import { toAppConfig } from '@vp/env-schema';
import { buildApp } from '../app';

const token = mintToken({ sub: '00000000-0000-7000-8000-00000000b001', role: 'user', ttl: '1h' });

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
    const app = await buildApp({ config });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${token}` },
      payload: { filename: 'clip.mp4', sizeBytes: 1024, contentType: 'video/mp4' },
    });
    await app.close();

    expect(res.json().singleUrl).toContain('/vp-raw/');
  });
});
