import { CommonErrorCodes } from '@kit/errors';
import type { Result } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { type InvalidDefinition, parseTheme, parseTokenSet, resolveTheme } from '../parse';
import { refFromTokens, themeFromTokens, tokenSetValues } from '../schema/__tests__/tokens-json';
import { RefSchema } from '../schema/ref';

const sand = () => themeFromTokens('sand');

const realRamps = () => RefSchema.parse(refFromTokens());

const resolveSand = (dark: Record<string, unknown> = {}, ramps = realRamps()) => {
  const theme = expectOk(
    parseTheme({ ...sand(), color: { ...sand().color, dark: { ...sand().color.dark, ...dark } } })
  );
  return resolveTheme(theme, ramps);
};

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

  it('resolves every ramp alias of a theme to the step it names, keeping plain colours', () => {
    const { color, dataviz } = expectOk(resolveSand());

    expect(sand().color.dark.bg).toBe('{ref.sand.950}');
    expect([color.dark.bg, color.dark.tint, dataviz.sequential[0]]).toEqual([
      '#14120F',
      '#FFFAF012',
      '#F5EAD4',
    ]);
  });

  it('resolves against the ramps it is handed, so a fake ramp set replaces the real one', () => {
    const fakeRamps = RefSchema.parse(
      Object.fromEntries(
        Object.entries(realRamps()).map(([ramp, steps]) => [
          ramp,
          Object.fromEntries(Object.keys(steps).map((step) => [step, '#123456'])),
        ])
      )
    );

    const { color, dataviz } = expectOk(resolveSand({}, fakeRamps));

    expect([color.dark.bg, color.dark.tint, dataviz.sequential[0]]).toEqual([
      '#123456',
      '#FFFAF012',
      '#123456',
    ]);
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
      label: 'a theme role naming a ramp step that does not exist',
      parse: () => resolveSand({ fg: '{ref.sand.960}' }),
      field: 'color.dark.fg',
    },
    {
      label: 'a theme role naming a key every object inherits',
      parse: () => resolveSand({ fg: '{ref.constructor.name}' }),
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
      code: CommonErrorCodes.VALIDATION_FAILED,
      message: expect.any(String),
      field,
    });
  });
});
