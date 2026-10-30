import { referenceInstant } from '../reference-instant';
import { NOW, contextFor } from './fixtures';

const LATER = '2026-09-25T00:00:00.000Z';

describe('@vp/intl: referenceInstant', () => {
  it.each([
    { scenario: "the value's own", now: LATER, context: contextFor('en'), expected: LATER },
    { scenario: "the context's", now: undefined, context: contextFor('en'), expected: NOW },
  ])('takes $scenario reference instant', ({ now, context, expected }) => {
    const instant = referenceInstant('relative', now, context);

    expect(instant.ok && instant.value.toISOString()).toBe(expected);
  });

  it.each([
    { scenario: 'there is none', now: undefined, context: contextFor('en', { now: undefined }) },
    { scenario: 'it is not ISO 8601', now: 'soon', context: contextFor('en') },
  ])('declines when $scenario', ({ now, context }) => {
    expect(referenceInstant('relative', now, context)).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNRENDERABLE', formatter: 'relative' },
    });
  });
});
