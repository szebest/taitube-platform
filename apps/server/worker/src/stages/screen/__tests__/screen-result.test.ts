import type { VideoScreening } from '@vp/domain';
import { toScreenResult } from '../screen-result';

const record = (overrides: Partial<VideoScreening>): VideoScreening => ({
  id: '0190e8a0-0000-7000-8000-000000000001',
  videoId: 'v',
  sourceChecksum: 'c',
  outcome: 'HOLD',
  score: 0.9,
  reasons: [{ reason: 'BLANK', score: 0.9, evidence: {} }],
  flags: [],
  modelVersion: null,
  thresholdVersion: 'v1',
  decision: null,
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: new Date(0),
  ...overrides,
});

describe('toScreenResult', () => {
  it.each([
    { scenario: 'an undecided hold', overrides: {}, outcome: 'HOLD', reasons: ['BLANK'] },
    {
      scenario: 'a rejected hold',
      overrides: { decision: 'rejected' as const },
      outcome: 'HOLD',
      reasons: ['BLANK'],
    },
    {
      scenario: 'an approved hold',
      overrides: { decision: 'approved' as const },
      outcome: 'PASS',
      reasons: [],
    },
    {
      scenario: 'a pass',
      overrides: { outcome: 'PASS' as const, reasons: [] },
      outcome: 'PASS',
      reasons: [],
    },
  ])('reads $scenario as $outcome', ({ overrides, outcome, reasons }) => {
    expect(toScreenResult(record(overrides))).toMatchObject({ type: 'screen', outcome, reasons });
  });
});
