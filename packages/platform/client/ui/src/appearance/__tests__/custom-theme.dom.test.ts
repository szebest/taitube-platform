import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { CUSTOM_THEME_START, registerCustomTheme } from '../custom-theme';

const emptyHost = (): { adoptedStyleSheets: CSSStyleSheet[] } => ({ adoptedStyleSheets: [] });

describe('@vp/ui: registerCustomTheme', () => {
  it.each([
    { ground: '#101820', accent: '#3366cc' },
    { ground: '#000000', accent: '#ffff00' },
    { ground: '#f5f0e6', accent: '#010101' },
  ])('registers the theme built from $ground and $accent, over the default theme', (colours) => {
    const host = emptyHost();

    const { theme, css } = expectOk(registerCustomTheme(colours, host));

    expect(theme).toMatchObject({ id: 'custom', name: 'Custom' });
    expect(css).toContain('[data-theme="custom"]');
    expect(host.adoptedStyleSheets).toHaveLength(1);
  });

  it.each([
    { ground: '#808080', accent: '#3366cc' },
    { ground: '#363636', accent: '#ffffff' },
  ])('installs nothing for the ground $ground outside the accent band', (colours) => {
    const host = emptyHost();

    expect(expectErr(registerCustomTheme(colours, host))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'ground',
      pairs: [],
    });
    expect(host.adoptedStyleSheets).toEqual([]);
  });

  it("opens on the default theme's own colours, which pass the gate", () => {
    expect(CUSTOM_THEME_START).toEqual({ ground: '#14120F', accent: '#C9A66B' });
    expectOk(registerCustomTheme(CUSTOM_THEME_START, null));
  });

  it('checks a theme without installing it for a null host', () => {
    expectOk(registerCustomTheme({ ground: '#101820', accent: '#3366cc' }, null));
  });

  it.each([
    { ground: 'dark', accent: '#3366cc' },
    { ground: '#101820', accent: 'blue' },
  ])('refuses a colour the engine cannot read: $ground $accent', (colours) => {
    expect(expectErr(registerCustomTheme(colours, null))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      pairs: [],
    });
  });
});
