import type { Job } from 'bullmq';
import { toQueueJob } from '../job-mapping';

function bullJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'v1--probe',
    name: 'probe',
    data: { videoId: 'v1' },
    attemptsMade: 2,
    opts: { attempts: 5, priority: 3 },
    ...overrides,
  } as unknown as Job;
}

describe('bullmq adapter: job mapping', () => {
  it('reduces a BullMQ job to the port vocabulary', () => {
    expect(toQueueJob(bullJob())).toEqual({
      id: 'v1--probe',
      name: 'probe',
      data: { videoId: 'v1' },
      attemptsMade: 2,
      opts: { jobId: 'v1--probe', attempts: 5, priority: 3 },
    });
  });

  it.each([
    { field: 'an absent id', job: bullJob({ id: undefined }), path: 'id', expected: '' },
    {
      field: 'absent options',
      job: bullJob({ opts: undefined }),
      path: 'attempts',
      expected: undefined,
    },
  ])('tolerates $field', ({ job, path, expected }) => {
    const mapped = toQueueJob(job) as unknown as Record<string, unknown> & {
      opts: Record<string, unknown>;
    };

    expect(path === 'id' ? mapped['id'] : mapped.opts[path]).toBe(expected);
  });
});
