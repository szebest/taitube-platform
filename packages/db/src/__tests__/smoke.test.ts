import { describe, expect, it } from 'vitest';
import { StepStatuses, VideoStatuses } from '../index.js';

describe('@vp/db smoke test', () => {
  it('exports video and step statuses matching SDD domain model', () => {
    expect(VideoStatuses).toContain('UPLOADING');
    expect(VideoStatuses).toContain('READY');
    expect(StepStatuses).toContain('RUNNING');
    expect(StepStatuses).toContain('DONE');
  });
});
