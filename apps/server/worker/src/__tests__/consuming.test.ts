import { ErrorCodes } from '@vp/errors';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { z } from 'zod';
import { consuming } from '../consuming';

const process = consuming(z.object({ videoId: z.uuid() }), async (job) => ok(job.data.videoId));
const run = (data: unknown) => process({ id: 'job-1', name: 'probe', data });

describe('apps/server/worker: consuming', () => {
  it('hands the stage the payload its contract read', async () => {
    const videoId = '018f0000-0000-7000-8000-0000000000a1';

    expect(expectOk(await run({ videoId }))).toBe(videoId);
  });

  it('fails a payload its contract refuses, naming the job, before the stage runs', async () => {
    expect(expectErr(await run({ videoId: 'x' }))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'data',
      message: expect.stringContaining('probe payload rejected'),
    });
  });
});
