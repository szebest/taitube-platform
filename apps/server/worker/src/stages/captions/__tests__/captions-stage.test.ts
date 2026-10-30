import { inProcessAppConfig } from '@vp/env-schema';
import { createCaptionsStage } from '../captions-stage';
import { captionsWorld } from './captions-harness';

describe('captions stage: the one queue', () => {
  it.each([
    {
      plan: { type: 'window', index: 0, windowCount: 3 } as const,
      outcome: { type: 'window', index: 0, cues: 18 },
    },
    {
      plan: { type: 'single' } as const,
      outcome: { type: 'track', outcome: 'ready', language: 'en', cues: 6 },
    },
  ])('hands a $plan.type job to its own processor', async ({ plan, outcome }) => {
    const world = await captionsWorld({ durationMs: plan.type === 'single' ? 60_000 : 400_000 });
    const { deps } = world;
    const stage = createCaptionsStage({
      config: inProcessAppConfig(),
      repositories: deps.repositories,
      storage: deps.storage,
      media: deps.media,
      speech: deps.speech,
      metrics: deps.metrics,
      workerId: deps.workerId,
      logger: deps.logger,
      now: deps.now,
    });

    expect(await stage(world.job(plan))).toEqual({ ok: true, value: outcome });
  });
});
