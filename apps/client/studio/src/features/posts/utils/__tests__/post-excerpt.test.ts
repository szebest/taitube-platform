import type { ManagedPostView } from '@vp/api-contracts';
import { postExcerpt } from '../post-excerpt';

type Body = ManagedPostView['body'];

const options = [
  { text: 'a', votes: null },
  { text: 'b', votes: null },
];
const poll = {
  question: 'Which?',
  options,
  closesAt: null,
  closed: false,
  votedIndex: null,
  totalVotes: null,
} as const;
const unavailable = { type: 'unavailable' } as const;
const video = {
  type: 'video',
  id: 'v',
  title: 'Tour',
  thumbnailUrl: null,
  durationSeconds: 5,
} as const;

describe('apps/client/studio: postExcerpt', () => {
  it.each<{ scenario: string; body: Body; expected: string }>([
    { scenario: 'a text', body: { kind: 'text', text: 'Hello' }, expected: 'Hello' },
    {
      scenario: 'images by their caption',
      body: { kind: 'images', caption: 'Set', images: [] },
      expected: 'Set',
    },
    {
      scenario: 'images without one by the first alt text',
      body: {
        kind: 'images',
        caption: null,
        images: [{ uploadId: 'u', alt: 'A desk', urls: { w640: '', w1280: '' } }],
      },
      expected: 'A desk',
    },
    { scenario: 'a poll by its question', body: { kind: 'poll', ...poll }, expected: 'Which?' },
    {
      scenario: 'a quiz by its question',
      body: { kind: 'quiz', ...poll, correctIndex: null, explanation: null },
      expected: 'Which?',
    },
    {
      scenario: 'a video share by its comment',
      body: { kind: 'video_share', comment: 'Watch', startMs: null, card: video },
      expected: 'Watch',
    },
    {
      scenario: 'a video share without one by the video',
      body: { kind: 'video_share', comment: null, startMs: null, card: video },
      expected: 'Tour',
    },
    {
      scenario: 'a share whose card is gone by nothing',
      body: { kind: 'playlist_share', comment: null, card: unavailable },
      expected: '',
    },
  ])('knows $scenario', ({ body, expected }) => {
    expect(postExcerpt(body)).toBe(expected);
  });
});
