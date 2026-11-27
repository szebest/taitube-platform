import type { PostDraft } from '#app/components/posts/post-composer/types';
import { decideDraft, type DraftProblem } from '../decide-draft';
import { EMPTY_DRAFT } from '../draft';

const NOW = new Date('2026-12-01T12:00:00.000Z');
const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-0000000fa010';
const VIDEO_ID = '0190c3a0-5e1d-7000-8000-0000000fa011';

const draft = (patch: Partial<PostDraft>): PostDraft => ({ ...EMPTY_DRAFT, ...patch });
const reasonOf = (problem: DraftProblem) =>
  problem.kind === 'rule' ? problem.message : problem.reason;
const decide = (patch: Partial<PostDraft>, current: 'draft' | 'published' | null = null) =>
  decideDraft(draft(patch), { now: NOW, current });

describe('apps/client/studio: decideDraft', () => {
  it.each([
    {
      scenario: 'a text, trimmed',
      patch: { text: '  Hello  ' },
      body: { payload: { kind: 'text', text: 'Hello' } },
    },
    {
      scenario: 'ready images with their alt text and no caption',
      patch: {
        kind: 'images' as const,
        images: [
          {
            key: 'a',
            fileName: 'a.png',
            previewUrl: 'blob:a',
            uploadId: UPLOAD_ID,
            alt: ' A desk ',
            status: 'ready' as const,
          },
        ],
      },
      body: {
        payload: {
          kind: 'images',
          images: [{ uploadId: UPLOAD_ID, alt: 'A desk' }],
          caption: null,
        },
      },
    },
    {
      scenario: 'a poll without a close time',
      patch: { kind: 'poll' as const, question: 'Which?', options: ['a', 'b'] },
      body: { payload: { kind: 'poll', question: 'Which?', options: ['a', 'b'], closesAt: null } },
    },
    {
      scenario: 'a quiz with its right answer and no explanation',
      patch: {
        kind: 'quiz' as const,
        question: 'Which?',
        options: ['a', 'b'],
        correctIndex: 1,
      },
      body: {
        payload: {
          kind: 'quiz',
          question: 'Which?',
          options: ['a', 'b'],
          closesAt: null,
          correctIndex: 1,
          explanation: null,
        },
      },
    },
    {
      scenario: 'a poll closing in a week',
      patch: {
        kind: 'poll' as const,
        question: 'Which?',
        options: ['a', 'b'],
        closesAt: '2026-12-08T12:00',
      },
      body: { payload: { kind: 'poll', closesAt: new Date('2026-12-08T12:00').toISOString() } },
    },
    {
      scenario: 'a video share at a second, with the switch off',
      patch: {
        kind: 'video_share' as const,
        video: { id: VIDEO_ID, title: 'Tour', durationMs: 60_000 },
        startMs: 5000,
        comment: ' ',
        commentsEnabled: false,
      },
      body: {
        payload: { kind: 'video_share', videoId: VIDEO_ID, comment: null, startMs: 5000 },
        commentsEnabled: false,
      },
    },
    {
      scenario: 'a playlist share',
      patch: {
        kind: 'playlist_share' as const,
        playlist: { id: VIDEO_ID, title: 'Best', durationMs: null },
        comment: 'Look',
      },
      body: { payload: { kind: 'playlist_share', playlistId: VIDEO_ID, comment: 'Look' } },
    },
    {
      scenario: 'a draft',
      patch: { text: 'Hello', timing: 'draft' as const },
      body: { timing: { mode: 'draft' } },
    },
    {
      scenario: 'a schedule in the future',
      patch: { text: 'Hello', timing: 'schedule' as const, publishAt: '2026-12-24T18:30' },
      body: {
        timing: { mode: 'schedule', publishAt: new Date('2026-12-24T18:30').toISOString() },
      },
    },
  ])('answers the body of $scenario', ({ patch, body }) => {
    const decided = decide({ text: 'Hello', ...patch });

    expect(decided.ok && decided.value).toMatchObject({
      commentsEnabled: true,
      timing: { mode: 'now' },
      ...body,
    });
  });

  it.each([
    { scenario: 'an empty text', patch: { text: ' ' }, says: 'text' },
    { scenario: 'a text over 2000', patch: { text: 'x'.repeat(2001) }, says: 'text' },
    { scenario: 'no images', patch: { kind: 'images' as const }, says: 'images' },
    {
      scenario: 'an image still uploading',
      patch: {
        kind: 'images' as const,
        images: [
          {
            key: 'a',
            fileName: 'a.png',
            previewUrl: 'blob:a',
            uploadId: UPLOAD_ID,
            alt: 'A desk',
            status: 'uploading' as const,
          },
        ],
      },
      says: 'uploading',
    },
    {
      scenario: 'an image without alt text',
      patch: {
        kind: 'images' as const,
        images: [
          {
            key: 'a',
            fileName: 'a.png',
            previewUrl: 'blob:a',
            uploadId: UPLOAD_ID,
            alt: ' ',
            status: 'ready' as const,
          },
        ],
      },
      says: 'alt',
    },
    {
      scenario: 'a poll of one option',
      patch: { kind: 'poll' as const, question: 'Which?', options: ['a'] },
      says: 'options',
    },
    {
      scenario: 'a poll question over 140',
      patch: { kind: 'poll' as const, question: 'q'.repeat(141), options: ['a', 'b'] },
      says: 'question',
    },
    {
      scenario: 'a quiz answer past its options',
      patch: {
        kind: 'quiz' as const,
        question: 'Which?',
        options: ['a', 'b'],
        correctIndex: 2,
      },
      says: 'correctIndex',
    },
    {
      scenario: 'a poll closing in the past',
      patch: {
        kind: 'poll' as const,
        question: 'Which?',
        options: ['a', 'b'],
        closesAt: '2026-11-01T12:00',
      },
      says: 'close',
    },
    {
      scenario: 'a poll closing after 30 days',
      patch: {
        kind: 'poll' as const,
        question: 'Which?',
        options: ['a', 'b'],
        closesAt: '2027-03-01T12:00',
      },
      says: 'close',
    },
    {
      scenario: 'a video share with no video',
      patch: { kind: 'video_share' as const },
      says: 'video',
    },
    {
      scenario: 'a playlist share with no playlist',
      patch: { kind: 'playlist_share' as const },
      says: 'playlist',
    },
    {
      scenario: 'a schedule with no time',
      patch: { text: 'Hello', timing: 'schedule' as const },
      says: 'date',
    },
    {
      scenario: 'a schedule in the past',
      patch: { text: 'Hello', timing: 'schedule' as const, publishAt: '2026-11-01T12:00' },
      says: 'past',
    },
  ])('refuses $scenario, naming $says', ({ patch, says }) => {
    const decided = decide({ text: 'Hello', ...patch });

    expect(!decided.ok && reasonOf(decided.error).toLowerCase()).toContain(says.toLowerCase());
  });

  it('keeps a published post published', () => {
    const decided = decide(
      { text: 'Hello', timing: 'schedule', publishAt: '2026-12-24T18:30' },
      'published'
    );

    expect(decided.ok).toBe(false);
  });
});
