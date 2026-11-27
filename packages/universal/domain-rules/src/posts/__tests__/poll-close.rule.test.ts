import { isErr, isOk } from '@kit/result';
import { decidePollClose } from '../poll-close.rule';
import { NOW, aPoll, aQuiz } from './poll-fixtures';

const days = (count: number) => new Date(NOW.getTime() + count * 86_400_000).toISOString();

describe('@vp/domain-rules: decidePollClose', () => {
  it.each([
    { name: 'no close time', payload: aPoll() },
    { name: 'a close time tomorrow', payload: aPoll({ closesAt: days(1) }) },
    { name: 'a close time in exactly 30 days', payload: aQuiz({ closesAt: days(30) }) },
    { name: 'a text', payload: { kind: 'text', text: 'x' } as const },
  ])('accepts $name', ({ payload }) => {
    expect(isOk(decidePollClose(payload, NOW))).toBe(true);
  });

  it.each([
    {
      name: 'the close time it already had, though it has passed',
      payload: aPoll({ closesAt: days(-5) }),
      previous: aPoll({ closesAt: days(-5) }),
    },
    {
      name: 'a close time after a later opening',
      payload: aPoll({ closesAt: days(40) }),
      opens: days(20),
    },
  ])('also accepts $name', ({ payload, previous, opens }) => {
    const opensAt = opens ? new Date(opens) : NOW;

    expect(isOk(decidePollClose(payload, opensAt, previous ?? null))).toBe(true);
  });

  it.each([
    {
      name: 'a close time before the scheduled opening',
      payload: aPoll({ closesAt: days(5) }),
      opens: days(10),
    },
    {
      name: 'a close time past 30 days of the scheduled opening',
      payload: aPoll({ closesAt: days(45) }),
      opens: days(10),
    },
  ])('refuses $name measured from the opening', ({ payload, opens }) => {
    expect(isErr(decidePollClose(payload, new Date(opens)))).toBe(true);
  });

  it.each([
    { name: 'a close time in the past', payload: aPoll({ closesAt: days(-1) }) },
    { name: 'a close time of exactly now', payload: aPoll({ closesAt: NOW.toISOString() }) },
    { name: 'a close time past 30 days', payload: aQuiz({ closesAt: days(31) }) },
  ])('refuses $name', ({ payload }) => {
    const result = decidePollClose(payload, NOW);

    expect(isErr(result) && result.error).toMatchObject({ field: 'closesAt' });
  });
});
