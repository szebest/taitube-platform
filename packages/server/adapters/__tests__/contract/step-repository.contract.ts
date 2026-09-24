import type { StepRepository } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const STEP_ID = '00000000-0000-7000-8000-000000000501';
const RECLAIM_STEP_ID = '00000000-0000-7000-8000-000000000502';
const TOKEN_A = '00000000-0000-7000-8000-0000000005a1';
const TOKEN_B = '00000000-0000-7000-8000-0000000005b1';

export function describeStepRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('StepRepository contract', () => {
    let subject: RepositoriesSubject;
    let steps: StepRepository;

    const claimProbe = (id: string, lockToken: string, attempt: number) =>
      steps.claim({
        id,
        videoId: VIDEO_IDS.a,
        step: 'probe',
        rendition: '-',
        jobId: `${VIDEO_IDS.a}--probe-${attempt}`,
        attempt,
        workerId: `worker-${attempt}`,
        lockToken,
      });

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      steps = subject.repositories.steps;
      await subject.repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING' })
      );
    });

    it('claims a fresh step and reports the lock token back', async () => {
      const claim = expectOk(await claimProbe(STEP_ID, TOKEN_A, 1));

      expect(claim.fenced).toBe(false);
      expect(claim.lockToken).toBe(TOKEN_A);

      const stored = expectOk(await steps.findByVideoId(VIDEO_IDS.a));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ step: 'probe', status: 'RUNNING', attempt: 1 });
    });

    it('fences a worker whose lock token was superseded by a re-claim', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);
      const reclaim = expectOk(await claimProbe(RECLAIM_STEP_ID, TOKEN_B, 2));
      expect(reclaim.fenced).toBe(false);

      const stale = expectOk(
        await steps.complete({
          videoId: VIDEO_IDS.a,
          step: 'probe',
          rendition: '-',
          lockToken: TOKEN_A,
          result: { from: 'zombie' },
        })
      );
      expect(stale).toEqual({ completed: false, fenced: true });

      const fresh = expectOk(
        await steps.complete({
          videoId: VIDEO_IDS.a,
          step: 'probe',
          rendition: '-',
          lockToken: TOKEN_B,
          result: { durationMs: 1000 },
        })
      );
      expect(fresh).toEqual({ completed: true, fenced: false });
    });

    it('stamps the finish time on the step it completes', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);
      await steps.complete({
        videoId: VIDEO_IDS.a,
        step: 'probe',
        rendition: '-',
        lockToken: TOKEN_A,
      });

      const [stored] = expectOk(await steps.findByVideoId(VIDEO_IDS.a));
      expect(stored).toMatchObject({ status: 'DONE' });
      expect(stored?.finishedAt).toBeInstanceOf(Date);
    });

    it('refuses to re-claim a finished step', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);
      await steps.complete({
        videoId: VIDEO_IDS.a,
        step: 'probe',
        rendition: '-',
        lockToken: TOKEN_A,
      });

      expect(expectOk(await claimProbe(RECLAIM_STEP_ID, TOKEN_B, 2)).fenced).toBe(true);
    });

    it('records a failure only for the holder of the lock', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);

      expect(
        expectOk(
          await steps.fail({
            videoId: VIDEO_IDS.a,
            step: 'probe',
            rendition: '-',
            lockToken: TOKEN_B,
            errorCode: 'CORRUPT_CONTAINER',
            errorMessage: 'nope',
          })
        )
      ).toEqual({ failed: false, fenced: true });

      expect(
        expectOk(
          await steps.fail({
            videoId: VIDEO_IDS.a,
            step: 'probe',
            rendition: '-',
            lockToken: TOKEN_A,
            errorCode: 'CORRUPT_CONTAINER',
            errorMessage: 'nope',
          })
        )
      ).toEqual({ failed: true, fenced: false });

      const [stored] = expectOk(await steps.findByVideoId(VIDEO_IDS.a));
      expect(stored).toMatchObject({ status: 'FAILED', errorCode: 'CORRUPT_CONTAINER' });
    });

    it('marks a known step dead and reports an unknown one as false', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);

      expect(
        expectOk(await steps.markDead({ videoId: VIDEO_IDS.a, step: 'probe', rendition: '-' }))
      ).toBe(true);
      expect(expectOk(await steps.findByVideoId(VIDEO_IDS.a))[0]?.status).toBe('DEAD');
      expect(
        expectOk(await steps.markDead({ videoId: VIDEO_IDS.a, step: 'package', rendition: '-' }))
      ).toBe(false);
    });

    it('heartbeats only a live lock token', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);

      expect(expectOk(await steps.heartbeat(TOKEN_A))).toBe(true);
      expect(expectOk(await steps.heartbeat(TOKEN_B))).toBe(false);
    });

    it('counts the running steps that have gone quiet', async () => {
      await claimProbe(STEP_ID, TOKEN_A, 1);

      expect(expectOk(await steps.countRunningStale(-1))).toBe(1);
      expect(expectOk(await steps.countRunningStale(3_600_000))).toBe(0);
    });
  });
}
