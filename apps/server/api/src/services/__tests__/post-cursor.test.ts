import { type CursorPayload, Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import type { ChannelPost, ChannelPostEntry } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  channelPostCursorPayload,
  decodeChannelPostCursor,
  decodeFeedPostCursor,
  feedPostCursorPayload,
} from '../post-cursor';

const PUBLISHED = new Date('2026-03-10T12:00:00.000Z');
const PINNED = new Date('2026-03-11T08:00:00.000Z');
const ID = '00000000-0000-7000-8000-0000000012c1';

function entry(pinnedAt: Date | null): ChannelPostEntry {
  const post: ChannelPost = {
    id: ID,
    channelId: ID,
    authorUserId: ID,
    payload: { kind: 'text', text: 'x' },
    status: 'published',
    publishAt: null,
    publishedAt: PUBLISHED,
    pinnedAt,
    commentsEnabled: true,
    editedAt: null,
    likeCount: 0,
    commentsCount: 0,
    version: 1,
    createdAt: PUBLISHED,
  };
  return { post, likedByViewer: false };
}

const paginator = new Paginator();

describe('apps/server/api/services: post cursors', () => {
  it.each([
    { scenario: 'an unpinned post', pinnedAt: null },
    { scenario: 'a pinned post', pinnedAt: PINNED },
  ])('walks a channel on from $scenario', ({ pinnedAt }) => {
    const cursor = paginator.encodeCursor(channelPostCursorPayload(entry(pinnedAt)));

    expect(expectOk(decodeChannelPostCursor(cursor, paginator))).toEqual({
      pinnedAt,
      publishedAt: PUBLISHED,
      id: ID,
    });
  });

  it('leaves the pin out of the feed, which ranks newest first whatever was pinned', () => {
    const cursor = paginator.encodeCursor(feedPostCursorPayload(entry(PINNED)));

    expect(expectOk(decodeFeedPostCursor(cursor, paginator))).toEqual({
      pinnedAt: null,
      publishedAt: PUBLISHED,
      id: ID,
    });
  });

  it.each([
    { scenario: 'no cursor', cursor: undefined },
    { scenario: 'an empty cursor', cursor: '' },
  ])('starts at the first page for $scenario', ({ cursor }) => {
    expect([
      expectOk(decodeChannelPostCursor(cursor, paginator)),
      expectOk(decodeFeedPostCursor(cursor, paginator)),
    ]).toEqual([null, null]);
  });

  it.each<{ scenario: string; payload: CursorPayload | null }>([
    { scenario: 'not a cursor', payload: null },
    { scenario: 'a payload without an id', payload: { publishedAt: PUBLISHED.toISOString() } },
    { scenario: 'a time that is not one', payload: { publishedAt: 'soon', id: ID } },
    {
      scenario: 'a pin that is not a time',
      payload: { pinnedAt: 'x', publishedAt: PUBLISHED.toISOString(), id: ID },
    },
  ])('refuses $scenario', ({ payload }) => {
    const cursor = payload ? paginator.encodeCursor(payload) : '!!';

    expect(expectErr(decodeChannelPostCursor(cursor, paginator)).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
