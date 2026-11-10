import type { VideoScreening } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { decodeScreeningCaseCursor, screeningCaseCursorPayload } from '../screening-cursor';

const paginator = new Paginator();
const CREATED_AT = new Date('2026-03-01T09:30:00.000Z');

const screening = (overrides: Partial<VideoScreening>): VideoScreening => ({
  id: 'screening-1',
  videoId: 'video-1',
  sourceChecksum: 'sum',
  outcome: 'HOLD',
  score: 0.9,
  reasons: [],
  flags: [],
  modelVersion: null,
  thresholdVersion: 'v1',
  decision: null,
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  flagsClearedAt: null,
  evidencePurgedAt: null,
  createdAt: CREATED_AT,
  ...overrides,
});

describe('apps/server/api/services: screening case cursor', () => {
  it.each([
    { scenario: 'an undecided hold', overrides: {}, open: true },
    { scenario: 'a decided hold', overrides: { decision: 'approved' as const }, open: false },
  ])('round-trips $scenario with the group it sorts in', ({ overrides, open }) => {
    const cursor = paginator.encodeCursor(screeningCaseCursorPayload(screening(overrides)));

    expect(expectOk(decodeScreeningCaseCursor(cursor, paginator))).toEqual({
      open,
      createdAt: CREATED_AT,
      id: 'screening-1',
    });
  });

  it('returns null for an absent cursor and rejects a broken one', () => {
    expect(decodeScreeningCaseCursor(undefined, paginator)).toEqual(ok(null));
    expect(expectErr(decodeScreeningCaseCursor('not-a-cursor', paginator)).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
