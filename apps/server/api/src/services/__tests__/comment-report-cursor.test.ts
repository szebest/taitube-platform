import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { commentReportCursorPayload, decodeCommentReportCursor } from '../cursor';

const paginator = new Paginator();
const CREATED_AT = new Date('2026-03-01T09:30:00.000Z');

describe('apps/server/api/services: comment report cursor', () => {
  it.each([
    { scenario: 'an open report', resolvedAt: null, open: true },
    { scenario: 'a resolved report', resolvedAt: CREATED_AT, open: false },
  ])('round-trips $scenario with the group it sorts in', ({ resolvedAt, open }) => {
    const cursor = paginator.encodeCursor(
      commentReportCursorPayload({ resolvedAt, createdAt: CREATED_AT, id: 'report-1' })
    );

    expect(expectOk(decodeCommentReportCursor(cursor, paginator))).toEqual({
      open,
      createdAt: CREATED_AT,
      id: 'report-1',
    });
  });

  it('returns null for an absent cursor and rejects a broken one', () => {
    expect(decodeCommentReportCursor(undefined, paginator)).toEqual(ok(null));
    expect(expectErr(decodeCommentReportCursor('not-a-cursor', paginator)).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
