import { NOTIFICATION_EXCERPT_LENGTH, type PostPayload } from '@vp/domain';
import { postExcerpt } from '../post-excerpt';

describe('apps/server/worker/stages: post-excerpt', () => {
  it.each<{ scenario: string; payload: PostPayload; excerpt: string | null }>([
    {
      scenario: 'a text post',
      payload: { kind: 'text', text: 'Dinner at nine' },
      excerpt: 'Dinner at nine',
    },
    {
      scenario: 'an image post with a caption',
      payload: { kind: 'images', images: [], caption: 'Plated' },
      excerpt: 'Plated',
    },
    {
      scenario: 'an image post without one',
      payload: { kind: 'images', images: [], caption: null },
      excerpt: null,
    },
    {
      scenario: 'a video share',
      payload: { kind: 'video_share', videoId: 'v1', comment: 'Watch this', startMs: null },
      excerpt: 'Watch this',
    },
    {
      scenario: 'a playlist share without a comment',
      payload: { kind: 'playlist_share', playlistId: 'p1', comment: null },
      excerpt: null,
    },
  ])('is $excerpt for $scenario', ({ payload, excerpt }) => {
    expect(postExcerpt(payload)).toBe(excerpt);
  });

  it('stops at the excerpt length', () => {
    const text = 'a'.repeat(NOTIFICATION_EXCERPT_LENGTH + 10);

    expect(postExcerpt({ kind: 'text', text })).toBe('a'.repeat(NOTIFICATION_EXCERPT_LENGTH));
  });
});
