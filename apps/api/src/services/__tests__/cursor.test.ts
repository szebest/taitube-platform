import { publicFeedRanking } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type InvalidCursor, Paginator } from '@vp/pagination';
import { type Result, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeFeedCursor,
  decodeSubscriptionCursor,
  feedCursorPayload,
  subscriptionCursorPayload,
} from '../cursor';

const paginator = new Paginator();
const CREATED_AT = new Date('2026-03-01T09:30:00.000Z');
const INSTANT = Date.parse('2026-03-01T12:00:00.000Z');
const ROW = { id: 'video-1', createdAt: CREATED_AT, viewsCount: 42 };

function expectRejected(decoded: Result<unknown, InvalidCursor>): void {
  expect(expectErr(decoded).code).toBe(ErrorCodes.INVALID_CURSOR);
}

describe('apps/api/services: pagination cursors', () => {
  describe('feed cursor', () => {
    it('round-trips the row a page resumes after, plus the instant it ranked against', () => {
      expect(
        expectOk(
          decodeFeedCursor(paginator.encodeCursor(feedCursorPayload(ROW, INSTANT)), paginator)
        )
      ).toEqual({
        id: 'video-1',
        createdAt: CREATED_AT,
        viewsCount: 42,
        instant: INSTANT,
      });
    });

    it('carries rank inputs rather than a rank, so no sort leaks onto the wire', () => {
      expect(feedCursorPayload(ROW, INSTANT)).toEqual({
        id: 'video-1',
        createdAt: CREATED_AT.toISOString(),
        viewsCount: 42,
        instant: INSTANT,
      });
    });

    it.each(['recent', 'popular', 'trending'] as const)(
      'yields the same %s rank the repository derives from the row itself',
      (sort) => {
        const cursor = expectOk(
          decodeFeedCursor(paginator.encodeCursor(feedCursorPayload(ROW, INSTANT)), paginator)
        );
        const rankOf = publicFeedRanking(sort);

        expect(rankOf(cursor as NonNullable<typeof cursor>, INSTANT)).toBe(rankOf(ROW, INSTANT));
      }
    );

    it('treats an absent view count as zero', () => {
      expect(feedCursorPayload({ id: 'video-1', createdAt: CREATED_AT }, INSTANT).viewsCount).toBe(
        0
      );
    });

    it('accepts an ISO string in place of a Date', () => {
      expect(feedCursorPayload({ ...ROW, createdAt: CREATED_AT.toISOString() }, INSTANT)).toEqual(
        feedCursorPayload(ROW, INSTANT)
      );
    });

    it('returns null for an absent cursor', () => {
      expect(decodeFeedCursor(undefined, paginator)).toEqual(ok(null));
      expect(decodeFeedCursor('', paginator)).toEqual(ok(null));
    });

    it.each<{ scenario: string; payload: Record<string, unknown> }>([
      { scenario: 'no instant', payload: { id: 'v1', createdAt: CREATED_AT.toISOString() } },
      {
        scenario: 'a non-finite instant',
        payload: { id: 'v1', createdAt: CREATED_AT.toISOString(), viewsCount: 1, instant: 'soon' },
      },
      {
        scenario: 'an unparseable date',
        payload: { id: 'v1', createdAt: 'yesterday', viewsCount: 1, instant: INSTANT },
      },
      {
        scenario: 'no id',
        payload: { createdAt: CREATED_AT.toISOString(), viewsCount: 1, instant: INSTANT },
      },
    ])('rejects a cursor with $scenario', ({ payload }) => {
      expectRejected(decodeFeedCursor(paginator.encodeCursor(payload as never), paginator));
    });

    it('rejects a cursor the codec cannot read at all', () => {
      expectRejected(decodeFeedCursor('not-a-cursor', paginator));
    });
  });

  describe('createdAt cursor', () => {
    it('round-trips the keyset', () => {
      const cursor = paginator.encodeCursor(createdAtCursorPayload(ROW));
      expect(expectOk(decodeCreatedAtCursor(cursor, paginator))).toEqual({
        id: 'video-1',
        createdAt: CREATED_AT,
      });
    });

    it('returns null for an absent cursor and rejects a broken one', () => {
      expect(decodeCreatedAtCursor(undefined, paginator)).toEqual(ok(null));
      expectRejected(decodeCreatedAtCursor('not-a-cursor', paginator));
    });
  });

  describe('subscription cursor', () => {
    it('round-trips the keyset', () => {
      const item = { channelId: 'channel-1', createdAt: CREATED_AT };
      const cursor = paginator.encodeCursor(subscriptionCursorPayload(item));
      expect(expectOk(decodeSubscriptionCursor(cursor, paginator))).toEqual(item);
    });

    it('returns null for an absent cursor and rejects a broken one', () => {
      expect(decodeSubscriptionCursor(undefined, paginator)).toEqual(ok(null));
      expectRejected(decodeSubscriptionCursor('not-a-cursor', paginator));
    });
  });
});
