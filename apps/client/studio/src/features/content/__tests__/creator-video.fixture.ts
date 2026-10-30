import { VIDEO_ID, videoSummary } from '@vp/web-testing';

import type { CreatorVideo } from '../components/library-video-row';

/** One video of the creator's library as the API answers it. */
export const creatorVideo = (overrides: Partial<CreatorVideo> = {}): CreatorVideo => ({
  ...videoSummary({
    title: 'Lisbon at night',
    durationMs: 765_000,
    viewsCount: 1_200_000,
    likesCount: 3400,
    thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  }),
  commentsCount: 4,
  tags: ['night'],
  ...overrides,
});

export const videoIdOf = (index: number) =>
  VIDEO_ID.replace(/a001$/, `a${String(index + 1).padStart(3, '0')}`);
