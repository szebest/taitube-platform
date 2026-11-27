import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decidePollUnlocked } from '../poll-lock.rule';
import { aPoll, aQuiz, postOf } from './poll-fixtures';

const quiz = aQuiz();
const poll = aPoll();

describe('@vp/domain-rules: decidePollUnlocked', () => {
  it.each([
    {
      name: 'any change before the first vote',
      post: postOf(poll),
      next: { ...poll, question: 'New?' },
      voteCount: 0,
    },
    { name: 'the same poll after votes', post: postOf(poll), next: poll, voteCount: 5 },
    {
      name: 'a new close time after votes',
      post: postOf(poll),
      next: { ...poll, closesAt: '2026-03-02T00:00:00.000Z' },
      voteCount: 5,
    },
    {
      name: 'a new explanation after votes',
      post: postOf(quiz),
      next: { ...quiz, explanation: 'Else' },
      voteCount: 5,
    },
    {
      name: 'a text post edited',
      post: postOf({ kind: 'text', text: 'a' }),
      next: { kind: 'text', text: 'b' } as const,
      voteCount: 0,
    },
  ])('allows $name', ({ post, next, voteCount }) => {
    expect(isOk(decidePollUnlocked({ post, next, voteCount }))).toBe(true);
  });

  it.each([
    { name: 'a reworded question', next: { ...poll, question: 'New?' } },
    { name: 'a changed option', next: { ...poll, options: ['a', 'x', 'c'] } },
    { name: 'a removed option', next: { ...poll, options: ['a', 'b'] } },
    { name: 'a poll turned into a text', next: { kind: 'text', text: 'x' } as const },
  ])('refuses $name once votes exist', ({ next }) => {
    const result = decidePollUnlocked({ post: postOf(poll), next, voteCount: 1 });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.POST_POLL_LOCKED);
  });

  it('refuses a moved correct answer once votes exist', () => {
    const result = decidePollUnlocked({
      post: postOf(quiz),
      next: aQuiz({ correctIndex: 0 }),
      voteCount: 1,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.POST_POLL_LOCKED);
  });
});
