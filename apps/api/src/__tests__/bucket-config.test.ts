import { mintToken } from '@vp/dev-token';
import { withEnv } from '@vp/testing';
import { buildApp } from '../app';

const token = mintToken({ sub: '00000000-0000-7000-8000-00000000b001', role: 'user', ttl: '1h' });

describe('apps/api: the raw bucket is the one the environment declares', () => {
  it('presigns an upload against S3_BUCKET_RAW', async () => {
    const singleUrl = await withEnv({ S3_BUCKET_RAW: 'vp-raw' }, async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: { filename: 'clip.mp4', sizeBytes: 1024, contentType: 'video/mp4' },
      });
      await app.close();
      return res.json().singleUrl as string;
    });

    expect(singleUrl).toContain('/vp-raw/');
  });
});
