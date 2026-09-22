import { publicFeedRanking } from '@vp/domain';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import {
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeFeedCursor,
  decodeSubscriptionCursor,
  encodeFeedCursor,
  feedCursorPayload,
  subscriptionCursorPayload,
} from '../cursor';

const paginator = new Paginator();
const CREATED_AT = new Date('2026-03-01T09:30:00.000Z');
const INSTANT = Date.parse('2026-03-01T12:00:00.000Z');
const ROW = { id: 'video-1', createdAt: CREATED_AT, viewsCount: 42 };

function expectRejected(run: () => unknown): void {
  expect(run).toThrow(PermanentError);
  try {
    run();
  } catch (err) {
    expect((err as PermanentError).code).toBe(ErrorCodes.VALIDATION_FAILED);
  }
}

describe('apps/api/services: pagination cursors', () => {
  describe('feed cursor', () => {
    it('round-trips the row a page resumes after, plus the instant it ranked against', () => {
      expect(decodeFeedCursor(encodeFeedCursor(ROW, INSTANT))).toEqual({
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
        const cursor = decodeFeedCursor(encodeFeedCursor(ROW, INSTANT));
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
      expect(decodeFeedCursor(undefined)).toBeNull();
      expect(decodeFeedCursor('')).toBeNull();
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
      const cursor = paginator.encodeCursor(payload as never);
      expectRejected(() => decodeFeedCursor(cursor));
    });

    it('rejects a cursor the codec cannot read at all', () => {
      expectRejected(() => decodeFeedCursor('not-a-cursor'));
    });
  });

  describe('createdAt cursor', () => {
    it('round-trips the keyset', () => {
      const cursor = paginator.encodeCursor(createdAtCursorPayload(ROW));
      expect(decodeCreatedAtCursor(cursor)).toEqual({ id: 'video-1', createdAt: CREATED_AT });
    });

    it('returns null for an absent cursor and rejects a broken one', () => {
      expect(decodeCreatedAtCursor(undefined)).toBeNull();
      expectRejected(() => decodeCreatedAtCursor('not-a-cursor'));
    });
  });

  describe('subscription cursor', () => {
    it('round-trips the keyset', () => {
      const item = { channelId: 'channel-1', createdAt: CREATED_AT };
      const cursor = paginator.encodeCursor(subscriptionCursorPayload(item));
      expect(decodeSubscriptionCursor(cursor)).toEqual(item);
    });

    it('returns null for an absent cursor and rejects a broken one', () => {
      expect(decodeSubscriptionCursor(undefined)).toBeNull();
      expectRejected(() => decodeSubscriptionCursor('not-a-cursor'));
    });
  });
});
