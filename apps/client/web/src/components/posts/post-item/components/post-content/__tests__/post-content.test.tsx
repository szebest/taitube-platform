import { renderPage } from '@vp/web-testing/server';
import {
  openPoll,
  openQuiz,
  post,
  SHARE_PLAYLIST_ID,
  SHARE_VIDEO_ID,
} from '#app/__tests__/post-fixtures';
import { AppProvidersWithToasts } from '#app/__tests__/providers';
import { PostContent } from '../post-content';

const IMAGES = post({
  kind: 'images',
  body: {
    kind: 'images',
    caption: 'Depot day',
    images: [
      {
        uploadId: SHARE_VIDEO_ID,
        alt: 'A tram in the depot',
        urls: { w640: 'https://cdn.test/d-640.webp', w1280: 'https://cdn.test/d-1280.webp' },
      },
    ],
  },
});

const VIDEO_SHARE = post({
  kind: 'video_share',
  body: {
    kind: 'video_share',
    comment: 'Watch from 1:30',
    startMs: 90_000,
    card: {
      type: 'video',
      id: SHARE_VIDEO_ID,
      title: 'Lisbon at night',
      thumbnailUrl: null,
      durationSeconds: 300,
    },
  },
});

const PLAYLIST_SHARE = post({
  kind: 'playlist_share',
  body: {
    kind: 'playlist_share',
    comment: null,
    card: { type: 'playlist', id: SHARE_PLAYLIST_ID, title: 'Night trams', itemCount: 3 },
  },
});

const GONE = post({
  kind: 'video_share',
  body: { kind: 'video_share', comment: null, startMs: null, card: { type: 'unavailable' } },
});

describe('apps/client/web: PostContent', () => {
  it.each([
    { kind: 'text', post: post(), shown: ['A new episode is out'] },
    { kind: 'images', post: IMAGES, shown: ['Depot day', 'alt="A tram in the depot"', '640w'] },
    { kind: 'poll', post: openPoll(), shown: ['Which tram next?', 'Line 28'] },
    { kind: 'quiz', post: openQuiz(), shown: ['Which year did line 28 open?', '1929'] },
    {
      kind: 'video_share',
      post: VIDEO_SHARE,
      shown: ['Watch from 1:30', `href="/watch/${SHARE_VIDEO_ID}?t=90"`, 'Lisbon at night'],
    },
    {
      kind: 'playlist_share',
      post: PLAYLIST_SHARE,
      shown: [`href="/playlist?list=${SHARE_PLAYLIST_ID}"`, 'Night trams'],
    },
    { kind: 'a gone share', post: GONE, shown: ['Unavailable'] },
  ])('draws a $kind post', async ({ post: shown, shown: texts }) => {
    const markup = await renderPage(<PostContent post={shown} />, AppProvidersWithToasts);

    for (const text of texts) {
      expect(markup).toContain(text);
    }
  });
});
