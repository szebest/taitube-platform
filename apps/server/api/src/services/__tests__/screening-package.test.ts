import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { CANONICAL_LADDER, PackageJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { buildApprovedPackageDispatch, enqueueApprovedPackage } from '../screening-package';

const VIDEO_ID = '00000000-0000-7000-8000-0000000006a1';
const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

describe('apps/server/api/services: approved package dispatch', () => {
  it.each([
    { name: 'an array of rungs', ladder: CANONICAL_LADDER, built: true },
    { name: 'a ladder of one rung', ladder: [CANONICAL_LADDER[2]], built: true },
    { name: 'an empty ladder', ladder: [], built: false },
    { name: 'no ladder recorded', ladder: null, built: false },
    { name: 'rungs of another shape', ladder: [{ name: '480p' }], built: false },
  ])('builds nothing from $name: built $built', ({ ladder, built }) => {
    const dispatch = buildApprovedPackageDispatch(
      { id: VIDEO_ID, generation: 1, ladder },
      TRACEPARENT
    );

    expect(dispatch !== null).toBe(built);
  });

  it('names a job of its own per generation, which a screened package reads as approved', () => {
    const dispatch = buildApprovedPackageDispatch(
      { id: VIDEO_ID, generation: 3, ladder: CANONICAL_LADDER },
      TRACEPARENT
    );

    expect(PackageJob.parse(dispatch?.data)).toMatchObject({
      videoId: VIDEO_ID,
      generation: 3,
      screened: true,
    });
    expect(dispatch?.opts.jobId).toBe(`${VIDEO_ID}--package--approved--g3`);
    expect(dispatch?.outbox).toMatchObject({
      kind: 'package',
      payload: { type: 'queue', queueName: 'package', job: { name: 'package' } },
    });
  });

  it('puts the same job on the queue the outbox row would', async () => {
    const queue = new InMemoryJobQueue('package');
    const dispatch = expectNonNull(
      buildApprovedPackageDispatch(
        { id: VIDEO_ID, generation: 1, ladder: CANONICAL_LADDER },
        TRACEPARENT
      )
    );

    await enqueueApprovedPackage(queue, dispatch);

    expect(queue.enqueuedJobs.map((job) => job.id)).toEqual([dispatch.opts.jobId]);
    expectOk(await queue.checkHealth());
  });
});

function expectNonNull<T>(value: T | null): T {
  if (value === null) throw new Error('expected a dispatch');
  return value;
}
