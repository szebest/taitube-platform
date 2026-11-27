import { isPollClosed, pollOf } from '../poll';
import { NOW, aPoll, aQuiz } from './poll-fixtures';

describe('@vp/domain-rules: poll helpers', () => {
  it.each([
    { name: 'a poll', payload: aPoll(), poll: true },
    { name: 'a quiz', payload: aQuiz(), poll: true },
    { name: 'a text', payload: { kind: 'text', text: 'x' } as const, poll: false },
  ])('tells whether $name is a poll', ({ payload, poll }) => {
    expect(pollOf(payload) !== null).toBe(poll);
  });

  it.each([
    { name: 'no close time', payload: aPoll(), closed: false },
    {
      name: 'a close time ahead',
      payload: aPoll({ closesAt: '2026-03-02T00:00:00.000Z' }),
      closed: false,
    },
    {
      name: 'a close time that passed',
      payload: aQuiz({ closesAt: '2026-02-01T00:00:00.000Z' }),
      closed: true,
    },
    {
      name: 'a close time of exactly now',
      payload: aPoll({ closesAt: NOW.toISOString() }),
      closed: true,
    },
    {
      name: 'a post that is no poll',
      payload: { kind: 'text', text: 'x' } as const,
      closed: false,
    },
  ])('reads $name as closed: $closed', ({ payload, closed }) => {
    expect(isPollClosed(payload, NOW)).toBe(closed);
  });
});
