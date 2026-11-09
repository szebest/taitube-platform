import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { buildTheme } from '../build-theme';
import { parseTheme, resolveTheme } from '../parse';
import { refFromTokens, themeFromTokens } from '../schema/__tests__/tokens-json';
import { RefSchema } from '../schema/ref';
import { checkThemeContrast } from '../theme-contrast';

const sand = expectOk(parseTheme(themeFromTokens('sand')));

const failing = (ground: string, accent: string) =>
  checkThemeContrast(
    expectOk(
      resolveTheme(
        expectOk(buildTheme(sand, { id: 'custom', name: 'Custom' }, { ground, accent })),
        RefSchema.parse(refFromTokens())
      )
    ),
    'core'
  ).map(({ mode, label }) => `${mode}: ${label}`);

describe('buildTheme', () => {
  it.each([
    { ground: '#14110d', accent: '#3366cc' },
    { ground: '#000000', accent: '#ffff00' },
    { ground: '#111111', accent: '#050505' },
    { ground: '#f5f0e6', accent: '#fefefe' },
    { ground: '#ffffff', accent: '#ffff00' },
  ])('builds a theme that passes the gate from $ground and $accent', ({ ground, accent }) => {
    expect(failing(ground, accent)).toEqual([]);
  });

  it.each([
    { ground: '#363636', accent: '#ffffff' },
    { ground: '#808080', accent: '#3366cc' },
    { ground: '#d9d9d9', accent: '#3366cc' },
  ])('refuses the ground $ground that sits outside the band accents are derived for', (colours) => {
    expect(expectErr(buildTheme(sand, { id: 'custom', name: 'Custom' }, colours))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'ground',
      value: colours.ground,
    });
  });

  it('keeps the base theme id, defaults and status roles but not its name', () => {
    const built = expectOk(
      buildTheme(sand, { id: 'custom', name: 'Custom' }, { ground: '#14110d', accent: '#3366cc' })
    );

    expect(built).toMatchObject({ id: 'custom', name: 'Custom', defaults: sand.defaults });
    expect(built.color.dark).toMatchObject({
      bg: '#14110D',
      live: sand.color.dark.live,
      danger: sand.color.dark.danger,
    });
    expect(built.color.light.bg).toBe(sand.color.light.bg);
  });

  it.each([
    { ground: 'dark', accent: '#3366cc' },
    { ground: '#14110d', accent: 'blue' },
    { ground: '#14110d80', accent: '#3366cc' },
  ])('refuses $ground and $accent', ({ ground, accent }) => {
    expect(
      expectErr(buildTheme(sand, { id: 'custom', name: 'Custom' }, { ground, accent })).code
    ).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
