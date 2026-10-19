import { ErrorCodes } from '@vp/errors';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { type InvalidDefinition, parseTheme, parseTokenSet } from '../parse';
import { themeFromTokens, tokenSetValues } from '../schema/__tests__/tokens-json';

const sand = () => themeFromTokens('sand');

const roundRadius = () => ({
  group: 'radius',
  id: 'round',
  values: tokenSetValues('radius').round,
});

type Parse = () => Result<unknown, InvalidDefinition>;

describe('parse', () => {
  it.each<{ label: string; parse: Parse; input: unknown }>([
    { label: 'a theme', parse: () => parseTheme(sand()), input: sand() },
    {
      label: 'a token set',
      parse: () => parseTokenSet('radius', roundRadius()),
      input: roundRadius(),
    },
  ])('returns $label that holds every rule', ({ parse, input }) => {
    expect(expectOk(parse())).toEqual(input);
  });

  it('types the values of a parsed token set as its own group', () => {
    const { values } = expectOk(parseTokenSet('radius', roundRadius()));

    expect(values.card satisfies string).toBe(roundRadius().values?.card);
  });

  it.each<{ label: string; parse: Parse; field: string }>([
    {
      label: 'a theme role that is not a colour',
      parse: () =>
        parseTheme({
          ...sand(),
          color: { ...sand().color, dark: { ...sand().color.dark, fg: 'white' } },
        }),
      field: 'color.dark.fg',
    },
    {
      label: 'a token set id the account cannot store',
      parse: () => parseTokenSet('radius', { ...roundRadius(), id: 'Round' }),
      field: 'id',
    },
    {
      label: 'a token set of another group',
      parse: () => parseTokenSet('shadow', roundRadius()),
      field: 'group',
    },
  ])('fails $label, naming the field', ({ parse, field }) => {
    expect(expectErr(parse())).toEqual({
      code: ErrorCodes.VALIDATION_FAILED,
      message: expect.any(String),
      field,
    });
  });
});
