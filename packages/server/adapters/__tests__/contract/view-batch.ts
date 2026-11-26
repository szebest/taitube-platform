import { randomUUID } from 'node:crypto';
import type { ViewBatch } from '@vp/domain';

export function viewBatch(overrides: Partial<ViewBatch> = {}): ViewBatch {
  return {
    batchId: randomUUID(),
    counts: [],
    retention: [],
    hourly: [],
    devices: [],
    shareLinks: [],
    experiments: [],
    ...overrides,
  };
}
