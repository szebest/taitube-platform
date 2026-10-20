import type { Theme } from '@vp/design-tokens';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { sand } from '../../themes/sand';
import { radiusSharp } from '../../tokens/radius/sharp';
import { registerTheme } from '../register-theme';

const dusk = (change: Partial<Theme> = {}): Theme => ({
  ...sand,
  id: 'dusk',
  name: 'Dusk',
  ...change,
});

const duskWithBg = (bg: Theme['color']['dark']['bg']) =>
  dusk({ color: { ...sand.color, dark: { ...sand.color.dark, bg } } });

const emptyHost = (): { adoptedStyleSheets: CSSStyleSheet[] } => ({ adoptedStyleSheets: [] });

const selectors = (host: ReturnType<typeof emptyHost>) =>
  host.adoptedStyleSheets.map((sheet) => {
    const [rule] = sheet.cssRules;
    return rule instanceof CSSStyleRule ? rule.selectorText : '';
  });

const cssOf = (host: ReturnType<typeof emptyHost>) =>
  host.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
    .join('\n');

describe('@vp/ui: registerTheme', () => {
  it('installs a passing theme as a stylesheet with its ramp steps resolved', () => {
    const host = emptyHost();

    const { theme } = expectOk(registerTheme(dusk(), host));

    expect(theme.color.dark.bg).toBe('#14120F');
    expect(selectors(host)).toEqual(['[data-theme="dusk"]']);
    expect(cssOf(host)).toContain('--bg: #14120F');
  });

  it('replaces the sheet of a theme registered again under its id, keeping the others', () => {
    const host = emptyHost();

    registerTheme(duskWithBg('#0C0B09'), host);
    registerTheme(dusk({ id: 'dawn' }), host);
    registerTheme(duskWithBg('#000000'), host);

    expect(selectors(host)).toEqual(['[data-theme="dawn"]', '[data-theme="dusk"]']);
    expect(cssOf(host)).toContain('--bg: #000000');
    expect(cssOf(host)).not.toContain('--bg: #0C0B09');
  });

  it('returns the pairs under their floor and installs nothing for a theme failing contrast', () => {
    const host = emptyHost();

    const failure = expectErr(registerTheme(duskWithBg('#8A8072'), host));

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'color',
      pairs: expect.arrayContaining([
        expect.objectContaining({ mode: 'dark', label: 'fg-muted on bg', floor: 4.5 }),
      ]),
    });
    expect(host.adoptedStyleSheets).toEqual([]);
  });

  it.each([
    { label: 'does not parse', input: { ...dusk(), name: '' }, field: 'name' },
    { label: 'takes a built-in id', input: { ...dusk(), id: 'sand' }, field: 'id' },
    {
      label: 'defaults to a set the registry does not offer',
      input: dusk({ defaults: { ...sand.defaults, radius: { ...radiusSharp, id: 'chiselled' } } }),
      field: 'defaults.radius',
    },
    {
      label: 'names a ramp step that does not exist',
      input: dusk({ color: { ...sand.color, dark: { ...sand.color.dark, bg: '{ref.sand.960}' } } }),
      field: 'color.dark.bg',
    },
  ])('refuses a theme that $label, naming the field, with no pairs', ({ input, field }) => {
    const host = emptyHost();

    expect(expectErr(registerTheme(input, host))).toMatchObject({ field, pairs: [] });
    expect(host.adoptedStyleSheets).toEqual([]);
  });

  it('returns the CSS to inline when there is no document to install it in, as on a server render', () => {
    const { theme, css } = expectOk(registerTheme(dusk(), null));

    expect(theme.id).toBe('dusk');
    expect(css).toContain('[data-theme="dusk"]');
    expect(css).toContain('--bg: #14120F;');
  });

  it('fails without throwing in a browser that cannot construct a stylesheet', () => {
    vi.stubGlobal('CSSStyleSheet', undefined);
    const host = emptyHost();

    expect(expectErr(registerTheme(dusk(), host))).toMatchObject({ code: ErrorCodes.INTERNAL });
    expect(host.adoptedStyleSheets).toEqual([]);
  });
});
