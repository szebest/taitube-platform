import type { PostView } from '@vp/api-contracts';
import { channel } from '@vp/web-testing';

export const POST_ID = '0190c3a0-5e1d-7000-8000-0000000e1001';
export const POLL_POST_ID = '0190c3a0-5e1d-7000-8000-0000000e1002';
const QUIZ_POST_ID = '0190c3a0-5e1d-7000-8000-0000000e1003';
export const NEXT_POST_ID = '0190c3a0-5e1d-7000-8000-0000000e1004';
export const SHARE_VIDEO_ID = '0190c3a0-5e1d-7000-8000-0000000e2001';
export const SHARE_PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-0000000e2002';

const PUBLISHED_AT = '2026-10-14T09:12:00.000Z';

export function post(overrides: Partial<PostView> = {}): PostView {
  const { id, handle, displayName, avatarUrl } = channel();

  return {
    id: POST_ID,
    channel: { id, handle, displayName, avatarUrl },
    kind: 'text',
    body: { kind: 'text', text: 'A new episode is out' },
    commentsEnabled: true,
    likeCount: 3,
    commentsCount: 2,
    likedByViewer: false,
    pinned: false,
    isEdited: false,
    publishedAt: PUBLISHED_AT,
    version: 1,
    ...overrides,
  };
}

type PollBody = Extract<PostView['body'], { kind: 'poll' }>;

/** A poll the viewer has not answered: no votes shown yet. */
export function openPoll(overrides: Partial<PollBody> = {}): PostView {
  return post({
    id: POLL_POST_ID,
    kind: 'poll',
    body: {
      kind: 'poll',
      question: 'Which tram next?',
      options: [
        { text: 'Line 28', votes: null },
        { text: 'Line 15', votes: null },
      ],
      closesAt: null,
      closed: false,
      votedIndex: null,
      totalVotes: null,
      ...overrides,
    },
  });
}

/** The same poll once the viewer chose option 0 and the results show. */
export function votedPoll(): PostView {
  return openPoll({
    options: [
      { text: 'Line 28', votes: 3 },
      { text: 'Line 15', votes: 1 },
    ],
    votedIndex: 0,
    totalVotes: 4,
  });
}

type QuizBody = Extract<PostView['body'], { kind: 'quiz' }>;

export function openQuiz(overrides: Partial<QuizBody> = {}): PostView {
  return post({
    id: QUIZ_POST_ID,
    kind: 'quiz',
    body: {
      kind: 'quiz',
      question: 'Which year did line 28 open?',
      options: [
        { text: '1914', votes: null },
        { text: '1929', votes: null },
      ],
      closesAt: null,
      closed: false,
      votedIndex: null,
      totalVotes: null,
      correctIndex: null,
      explanation: null,
      ...overrides,
    },
  });
}

/** The quiz once the viewer answered option `answer`; 1929 is right. */
export function answeredQuiz(answer: number): PostView {
  return openQuiz({
    options: [
      { text: '1914', votes: 1 },
      { text: '1929', votes: 3 },
    ],
    votedIndex: answer,
    totalVotes: 4,
    correctIndex: 1,
    explanation: 'The first service ran in 1929.',
  });
}
