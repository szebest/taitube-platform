import { describe, expect, it } from 'vitest';
import { getWorkerStage } from '../config';
import { STAGE_REGISTRY } from '../registry';

describe('@vp/worker smoke test (dual-runtime)', () => {
  it('loads worker stage configuration and defaults to probe', () => {
    const stage = getWorkerStage();
    expect(stage).toBeDefined();
    expect(STAGE_REGISTRY.probe).toBeDefined();
    expect(STAGE_REGISTRY.probe?.concurrency).toBeGreaterThan(0);
  });

  it.each([
    'probe',
    'transcode-1080p',
    'transcode-720p',
    'transcode-480p',
    'thumbnail',
    'package',
    'notify',
    'housekeeping',
  ])('contains configuration for stage "%s"', (stage) => {
    expect(STAGE_REGISTRY[stage]).toBeDefined();
  });
});
