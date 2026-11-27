import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decidePollVote } from '../poll-vote.rule';
import { NOW, aPoll, aQuiz, postOf } from './poll-fixtures';

const past = '2026-02-28T00:00:00.000Z';
const future = '2026-03-02T00:00:00.000Z';

describe('@vp/domain-rules: decidePollVote', () => {
  it.each([
    { name: 'the first option of a poll', post: postOf(aPoll()), optionIndex: 0 },
    { name: 'the last option of a quiz', post: postOf(aQuiz()), optionIndex: 2 },
    { name: 'a poll that closes later', post: postOf(aPoll({ closesAt: future })), optionIndex: 1 },
  ])('accepts $name', ({ post, optionIndex }) => {
    const result = decidePollVote({ post, optionIndex, now: NOW });

    expect(isOk(result) && result.value).toBe(optionIndex);
  });

  it.each([
    {
      name: 'a closed poll',
      post: postOf(aPoll({ closesAt: past })),
      optionIndex: 0,
      code: ErrorCodes.POST_POLL_CLOSED,
    },
    {
      name: 'a closed quiz',
      post: postOf(aQuiz({ closesAt: past })),
      optionIndex: 0,
      code: ErrorCodes.POST_POLL_CLOSED,
    },
    {
      name: 'an index past the options',
      post: postOf(aPoll()),
      optionIndex: 3,
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a negative index',
      post: postOf(aPoll()),
      optionIndex: -1,
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a fractional index',
      post: postOf(aPoll()),
      optionIndex: 0.5,
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a text post',
      post: postOf({ kind: 'text', text: 'hi' }),
      optionIndex: 0,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $name', ({ post, optionIndex, code }) => {
    const result = decidePollVote({ post, optionIndex, now: NOW });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
