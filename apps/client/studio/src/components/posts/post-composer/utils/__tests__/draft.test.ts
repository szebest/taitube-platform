import type { ManagedPostView } from '@vp/api-contracts';
import {
  managedPost,
  PLAYLIST_ID,
  VIDEO_ID,
} from '#app/components/posts/post-composer/__tests__/managed-post.fixture';
import { draftOfPost, EMPTY_DRAFT, fromLocalInput, toLocalInput } from '../draft';

type PollBody = Extract<ManagedPostView['body'], { kind: 'poll' }>;

const poll = (): PollBody => ({
  kind: 'poll',
  question: 'Next topic?',
  options: [
    { text: 'Lighting', votes: 3 },
    { text: 'Audio', votes: 1 },
  ],
  closesAt: '2026-12-24T18:30:00.000Z',
  closed: false,
  votedIndex: null,
  totalVotes: 4,
});

describe('apps/client/studio: post draft', () => {
  it.each([
    { scenario: 'a whole local time', local: '2026-12-24T18:30', defined: true },
    { scenario: 'a date without a time', local: '2026-12-24T', defined: false },
    { scenario: 'a time without a date', local: 'T18:30', defined: false },
    { scenario: 'nothing', local: '', defined: false },
  ])('reads $scenario as an instant: $defined', ({ local, defined }) => {
    expect(fromLocalInput(local) !== undefined).toBe(defined);
  });

  it('writes an instant back as the local time it was read from', () => {
    const instant = fromLocalInput('2026-12-24T18:30');

    expect(toLocalInput(instant?.toISOString() ?? '')).toBe('2026-12-24T18:30');
  });

  it.each([
    {
      scenario: 'a text post',
      post: managedPost(),
      expected: { kind: 'text', text: 'Hello from the studio', timing: 'now' },
    },
    {
      scenario: 'a poll with a close time',
      post: managedPost(poll(), { status: 'draft', publishedAt: null }),
      expected: {
        kind: 'poll',
        question: 'Next topic?',
        options: ['Lighting', 'Audio'],
        timing: 'draft',
      },
    },
    {
      scenario: 'a quiz keeping its right answer and explanation',
      post: managedPost({
        ...poll(),
        kind: 'quiz',
        correctIndex: 1,
        explanation: 'Because',
      }),
      expected: { kind: 'quiz', correctIndex: 1, explanation: 'Because' },
    },
    {
      scenario: 'a quiz whose answer is not shown',
      post: managedPost({ ...poll(), kind: 'quiz', correctIndex: null, explanation: null }),
      expected: { kind: 'quiz', correctIndex: 0, explanation: '' },
    },
    {
      scenario: 'a video share at a second',
      post: managedPost({
        kind: 'video_share',
        comment: 'Watch',
        startMs: 5000,
        card: {
          type: 'video',
          id: VIDEO_ID,
          title: 'Tour',
          thumbnailUrl: null,
          durationSeconds: 90,
        },
      }),
      expected: {
        kind: 'video_share',
        comment: 'Watch',
        startMs: 5000,
        video: { id: VIDEO_ID, title: 'Tour', durationMs: 90_000 },
      },
    },
    {
      scenario: 'a playlist share',
      post: managedPost({
        kind: 'playlist_share',
        comment: null,
        card: { type: 'playlist', id: PLAYLIST_ID, title: 'Best of', itemCount: 4 },
      }),
      expected: {
        kind: 'playlist_share',
        comment: '',
        playlist: { id: PLAYLIST_ID, title: 'Best of', durationMs: null },
      },
    },
    {
      scenario: 'a share whose card is gone',
      post: managedPost({
        kind: 'playlist_share',
        comment: 'Old',
        card: { type: 'unavailable' },
      }),
      expected: { kind: 'playlist_share', playlist: null },
    },
    {
      scenario: 'images already uploaded',
      post: managedPost({
        kind: 'images',
        caption: 'Set',
        images: [
          {
            uploadId: VIDEO_ID,
            alt: 'A desk',
            urls: { w640: 'https://cdn/640.webp', w1280: 'https://cdn/1280.webp' },
          },
        ],
      }),
      expected: {
        kind: 'images',
        caption: 'Set',
        images: [
          {
            key: VIDEO_ID,
            fileName: 'A desk',
            previewUrl: 'https://cdn/640.webp',
            uploadId: VIDEO_ID,
            alt: 'A desk',
            status: 'ready',
          },
        ],
      },
    },
  ])('holds $scenario', ({ post, expected }) => {
    expect(draftOfPost(post)).toMatchObject(expected);
  });

  it.each([
    { status: 'draft', timing: 'draft' },
    { status: 'scheduled', timing: 'schedule' },
    { status: 'published', timing: 'now' },
  ] as const)('turns a $status post into the $timing choice', ({ status, timing }) => {
    expect(draftOfPost(managedPost(undefined, { status })).timing).toBe(timing);
  });

  it('keeps the switch for replies, and the schedule as a local time', () => {
    const draft = draftOfPost(
      managedPost(undefined, {
        commentsEnabled: false,
        status: 'scheduled',
        publishAt: '2026-12-24T18:30:00.000Z',
      })
    );

    expect(draft.commentsEnabled).toBe(false);
    expect(fromLocalInput(draft.publishAt)?.toISOString()).toBe('2026-12-24T18:30:00.000Z');
  });

  it('starts a new post as a published text with replies on', () => {
    expect(EMPTY_DRAFT).toMatchObject({ kind: 'text', timing: 'now', commentsEnabled: true });
  });
});
