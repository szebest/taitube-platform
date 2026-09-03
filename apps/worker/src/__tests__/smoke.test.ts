import { describe, expect, it } from 'vitest';
import { getWorkerStage } from '../config.js';
import { STAGE_REGISTRY } from '../registry.js';

describe('@vp/worker smoke test (dual-runtime)', () => {
  it('loads worker stage configuration and defaults to probe', () => {
    const stage = getWorkerStage();
    expect(stage).toBeDefined();
    expect(STAGE_REGISTRY.probe).toBeDefined();
    expect(STAGE_REGISTRY.probe?.concurrency).toBeGreaterThan(0);
  });

  it('contains configurations for all required stages', () => {
    const expectedStages = [
      'probe',
      'transcode-1080p',
      'transcode-720p',
      'transcode-480p',
      'thumbnail',
      'package',
      'notify',
      'housekeeping',
    ];
    for (const st of expectedStages) {
      expect(STAGE_REGISTRY[st]).toBeDefined();
    }
  });
});
