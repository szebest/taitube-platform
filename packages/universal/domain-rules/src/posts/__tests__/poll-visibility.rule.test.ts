import { decidePollVisibility } from '../poll-visibility.rule';
import { NOW, aPoll, aQuiz } from './poll-fixtures';

const closed = '2026-02-01T00:00:00.000Z';

describe('@vp/domain-rules: decidePollVisibility', () => {
  it.each([
    {
      name: 'an open poll nobody voted on',
      payload: aPoll(),
      votedIndex: null,
      isMember: false,
      expected: { results: false, answer: false },
    },
    {
      name: 'a poll the viewer voted on',
      payload: aPoll(),
      votedIndex: 1,
      isMember: false,
      expected: { results: true, answer: false },
    },
    {
      name: 'a closed poll',
      payload: aPoll({ closesAt: closed }),
      votedIndex: null,
      isMember: false,
      expected: { results: true, answer: false },
    },
    {
      name: 'an open poll to a member',
      payload: aPoll(),
      votedIndex: null,
      isMember: true,
      expected: { results: true, answer: false },
    },
    {
      name: 'an open quiz nobody answered',
      payload: aQuiz(),
      votedIndex: null,
      isMember: false,
      expected: { results: false, answer: false },
    },
    {
      name: 'a quiz the viewer answered',
      payload: aQuiz(),
      votedIndex: 0,
      isMember: false,
      expected: { results: true, answer: true },
    },
    {
      name: 'a closed quiz',
      payload: aQuiz({ closesAt: closed }),
      votedIndex: null,
      isMember: false,
      expected: { results: true, answer: true },
    },
    {
      name: 'a quiz to a member',
      payload: aQuiz(),
      votedIndex: null,
      isMember: true,
      expected: { results: true, answer: true },
    },
  ])('shows $name as $expected', ({ payload, votedIndex, isMember, expected }) => {
    expect(decidePollVisibility({ payload, votedIndex, isMember, now: NOW })).toEqual(expected);
  });
});
