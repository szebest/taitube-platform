import { matchesInbox } from '../comment-inbox-filter';

const OWNER = 'owner-1';
const at = (minute: number) => new Date(Date.UTC(2026, 2, 1, 12, minute));

const question = { id: 'q', parentId: null, authorId: 'viewer-1', createdAt: at(0) };
const answer = { id: 'a', parentId: 'q', authorId: OWNER, createdAt: at(5) };
const earlierAnswer = { ...answer, createdAt: at(-5) };
const neverReported = { hasOpenReport: () => false };

describe('matchesInbox', () => {
  it('keeps everything for the whole inbox', () => {
    expect(matchesInbox(question, 'all', OWNER, [question], neverReported)).toBe(true);
  });

  it.each([
    { scenario: 'no reply of the owner', live: [question], unanswered: true },
    { scenario: 'a later reply of the owner', live: [question, answer], unanswered: false },
    {
      scenario: 'a reply of the owner from before',
      live: [question, earlierAnswer],
      unanswered: true,
    },
    {
      scenario: 'a later reply of someone else',
      live: [question, { ...answer, authorId: 'x' }],
      unanswered: true,
    },
  ])('is unanswered with $scenario: $unanswered', ({ live, unanswered }) => {
    expect(matchesInbox(question, 'unanswered', OWNER, live, neverReported)).toBe(unanswered);
  });

  it('follows the open reports for the reported filter', () => {
    const reports = { hasOpenReport: (id: string) => id === 'q' };

    expect(matchesInbox(question, 'reported', OWNER, [question], reports)).toBe(true);
    expect(matchesInbox(answer, 'reported', OWNER, [question, answer], reports)).toBe(false);
  });
});
