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
    { name: 'a close time in the past', payload: aPoll({ closesAt: days(-1) }) },
    { name: 'a close time of exactly now', payload: aPoll({ closesAt: NOW.toISOString() }) },
    { name: 'a close time past 30 days', payload: aQuiz({ closesAt: days(31) }) },
  ])('refuses $name', ({ payload }) => {
    const result = decidePollClose(payload, NOW);

    expect(isErr(result) && result.error).toMatchObject({ field: 'closesAt' });
  });
});
