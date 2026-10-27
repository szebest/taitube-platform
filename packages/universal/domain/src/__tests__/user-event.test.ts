import type { CommentThread } from '../comment';
import { commentCreated, preferencesUpdated, videoStatusChanged } from '../user-event';

describe('domain: user event', () => {
  it('announces a video status as a video.processing status change', () => {
    expect(videoStatusChanged('v1', 'READY')).toEqual({
      type: 'video.processing',
      payload: { videoId: 'v1', change: { kind: 'status', status: 'READY' } },
    });
  });

  it('announces a preferences save with the sections it changed and the version it made', () => {
    expect(preferencesUpdated(['playback', 'privacy'], 4)).toEqual({
      type: 'preferences.updated',
      payload: { sections: ['playback', 'privacy'], version: 4 },
    });
  });

  it('announces a new comment with its author and the video it is on, and nothing more', () => {
    const thread: CommentThread = {
      id: 'c1',
      videoId: 'v1',
      authorId: 'u2',
      parentId: null,
      content: 'nice',
      isPinned: false,
      isEdited: false,
      likeCount: 0,
      heartedAt: null,
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
      replyCount: 0,
      author: { userId: 'u2', channelId: 'ch', handle: 'fan', displayName: 'Fan', avatarUrl: 'x' },
    };

    expect(commentCreated(thread, { id: 'v1', title: 'Clip' })).toEqual({
      type: 'comment.created',
      payload: {
        comment: {
          id: 'c1',
          parentId: null,
          content: 'nice',
          createdAt: '2026-03-01T12:00:00.000Z',
          author: { userId: 'u2', handle: 'fan', displayName: 'Fan' },
        },
        video: { id: 'v1', title: 'Clip' },
      },
    });
  });
});
