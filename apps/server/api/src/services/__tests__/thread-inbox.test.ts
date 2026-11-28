import type { VideoThread, VideoThreadEntry } from '@vp/domain';
import { heldThreadInboxRow } from '../thread-inbox';

const thread: VideoThread = {
  id: 'thread-1',
  videoId: 'video-1',
  channelId: 'channel-1',
  authorId: 'author-1',
  authorChannelId: 'author-channel-1',
  anchorMs: 500,
  title: 'The cut',
  body: 'Around the second shot',
  pinnedAt: null,
  commentsCount: 0,
  moderationState: 'held',
  moderationDisclosure: 'visible',
  heldReason: 'review_all',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const entry = (over: Partial<VideoThread> = {}): VideoThreadEntry => ({
  thread: { ...thread, ...over },
  author: { channelId: 'author-channel-1', handle: 'fan', displayName: 'Fan', avatarUrl: null },
  replyCount: 2,
  markerReplies: 0,
  markerRepliers: 0,
  authorShadowed: false,
});

describe('apps/server/api/services: held thread inbox row', () => {
  it('shows the thread as a held row on itself, under its video', () => {
    expect(heldThreadInboxRow(entry(), { id: 'video-1', title: 'Clip' })).toMatchObject({
      id: 'thread-1',
      target: { type: 'thread', id: 'thread-1' },
      content: 'The cut\nAround the second shot',
      moderationState: 'held',
      heldReason: 'review_all',
      author: { userId: 'author-1', handle: 'fan' },
      replyCount: 2,
      video: { id: 'video-1', title: 'Clip' },
      targetSummary: { type: 'thread', id: 'thread-1', title: 'The cut' },
    });
  });

  it('reads a thread with no body as its title', () => {
    expect(heldThreadInboxRow(entry({ body: '' }), { id: 'video-1', title: 'Clip' }).content).toBe(
      'The cut'
    );
  });
});
