import { err, isErr, ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { inClaimedStep, stepRenditionOf } from '../captions-run';
import { captionsWorld } from './captions-harness';

describe('captions stage: claiming a run', () => {
  it.each([
    { plan: { type: 'single' } as const, rendition: 'small-q5_1--v1' },
    { plan: { type: 'merge', windowCount: 3 } as const, rendition: 'small-q5_1--v1' },
    {
      plan: { type: 'window', index: 2, windowCount: 3 } as const,
      rendition: 'small-q5_1--v1--w2',
    },
  ])('keeps a $plan.type step row as $rendition', async ({ plan, rendition }) => {
    const world = await captionsWorld();

    expect(stepRenditionOf(world.job(plan).data)).toBe(rendition);
  });

  it('commits the step done and hands the work its scratch directory', async () => {
    const world = await captionsWorld();

    const ran = await inClaimedStep(world.deps, world.job({ type: 'single' }), async (scope) => {
      expect(scope.track.id).toBe(world.track.id);
      return ok('done');
    });

    expect(expectOk(ran)).toBe('done');
    const [step] = expectOk(await world.repositories.steps.findByVideoId(world.videoId));
    expect(step).toMatchObject({ step: 'captions', rendition: 'small-q5_1--v1', status: 'DONE' });
  });

  it('records a failed step and returns the failure for a retry', async () => {
    const world = await captionsWorld();
    const failure = { code: 'WHISPER_FAILED' as const, message: 'boom' };

    const ran = await inClaimedStep(world.deps, world.job({ type: 'single' }), async () =>
      err(failure)
    );

    expect(isErr(ran) && ran.error).toEqual(failure);
    const [step] = expectOk(await world.repositories.steps.findByVideoId(world.videoId));
    expect(step).toMatchObject({ status: 'FAILED', errorCode: 'WHISPER_FAILED' });
  });
});
