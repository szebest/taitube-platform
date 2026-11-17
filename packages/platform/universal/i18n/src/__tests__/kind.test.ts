import { ok } from '@kit/result';
import { defineKind, isConfigKey, isRecord, type KindContext } from '../kind';
import { intlFor } from './fixtures';

const shout = defineKind({
  name: 'shout',
  config: 'optional',
  arg: (value): value is string => typeof value === 'string',
  options: (value): value is { readonly marks: number } =>
    isRecord(value) && typeof value.marks === 'number',
  render: (value, options) => ok(`${value.toUpperCase()}${'!'.repeat(options?.marks ?? 1)}`),
});

const context: KindContext = { intl: intlFor('en'), render: () => ok('') };

describe('@kit/i18n: defineKind', () => {
  it.each([
    { scenario: 'with no entry', entry: undefined, expected: ok('HI!') },
    { scenario: 'with its options', entry: { marks: 3 }, expected: ok('HI!!!') },
  ])('renders a value $scenario', ({ entry, expected }) => {
    expect(shout.format('{x:shout}', 'hi', entry, context)).toEqual(expected);
  });

  it.each([
    {
      scenario: 'a value its guard declines',
      value: 5,
      entry: undefined,
      code: 'FORMAT_WRONG_KIND',
    },
    {
      scenario: 'an entry of the wrong shape',
      value: 'hi',
      entry: { marks: 'x' },
      code: 'FORMAT_UNRENDERABLE',
    },
  ])('fails on $scenario, naming the token', ({ value, entry, code }) => {
    expect(shout.format('{x:shout}', value, entry, context)).toEqual({
      ok: false,
      error: expect.objectContaining({ code, formatter: '{x:shout}' }),
    });
  });

  it('keeps its name and requirement as data', () => {
    expect([shout.name, shout.config, Object.isFrozen(shout)]).toEqual(['shout', 'optional', true]);
  });

  it.each([
    { value: 'ready', expected: true },
    { value: 1, expected: false },
  ])('isConfigKey($value) is $expected', ({ value, expected }) => {
    expect(isConfigKey(value)).toBe(expected);
  });

  it.each([
    { value: {}, expected: true },
    { value: [], expected: false },
    { value: null, expected: false },
    { value: 'x', expected: false },
  ])('isRecord($value) is $expected', ({ value, expected }) => {
    expect(isRecord(value)).toBe(expected);
  });
});
