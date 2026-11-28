import { ok } from '@kit/result';
import { createIntl } from '../create-intl';
import { defineKind, describeValue, optionKeys, runKind } from '../kind';
import { contextFor } from './fixtures';

const shout = defineKind({
  name: 'shout',
  arg: (value): value is string => typeof value === 'string',
  options: optionKeys<{ readonly marks?: number }>(['marks']),
  render: (value, options) => ok(`${value.toUpperCase()}${'!'.repeat(options?.marks ?? 1)}`),
});

const context = createIntl(contextFor('en')).context;

describe('@kit/intl: kinds', () => {
  it.each([
    { scenario: 'no options', options: undefined, expected: ok('HI!') },
    { scenario: 'its own options', options: { marks: 3 }, expected: ok('HI!!!') },
  ])('renders a value with $scenario', ({ options, expected }) => {
    expect(runKind(shout, 'hi', options, context)).toEqual(expected);
  });

  it.each([
    {
      scenario: 'a value its guard declines',
      value: 5,
      options: undefined,
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'an option it does not name',
      value: 'hi',
      options: { mraks: 1 },
      code: 'FORMAT_UNKNOWN_OPTION',
    },
    {
      scenario: 'options that are no object',
      value: 'hi',
      options: 'loud',
      code: 'FORMAT_UNRENDERABLE',
    },
  ])('declines $scenario, naming the caller', ({ value, options, code }) => {
    expect(runKind(shout, value, options, context, '{x:shout}')).toEqual({
      ok: false,
      error: expect.objectContaining({ code, formatter: '{x:shout}' }),
    });
  });

  it('is frozen data', () => {
    expect([shout.name, Object.isFrozen(shout)]).toEqual(['shout', true]);
  });

  it.each([
    { value: ['a'], expected: 'array' },
    { value: 1, expected: 'number' },
    { value: null, expected: 'object' },
  ])('describes $value as $expected', ({ value, expected }) => {
    expect(describeValue(value)).toBe(expected);
  });
});
