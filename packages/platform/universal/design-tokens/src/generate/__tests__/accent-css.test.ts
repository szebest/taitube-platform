import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { accentCss, brandAccentCss, brandKey } from '../accent-css';
import { lines } from './fixture';

describe('accentCss', () => {
  it('writes the derived accent roles per mode family, above any theme rule', () => {
    expect(expectOk(accentCss('#3366CC'))).toBe(
      lines(
        ':root[data-theme]:is([data-mode="dark"], [data-mode="oled"]) {',
        '  --accent: #396CD3;',
        '  --accent-hover: #3F72DA;',
        '  --accent-soft: #396CD329;',
        '  --on-accent: #FFFFFF;',
        '  --accent-ink: #6499FF;',
        '  --focus-ring: #396CD3;',
        '}',
        '',
        ':root[data-theme]:is([data-mode="light"]) {',
        '  --accent: #3366CC;',
        '  --accent-hover: #2557BB;',
        '  --accent-soft: #3366CC29;',
        '  --on-accent: #FFFFFF;',
        '  --accent-ink: #2557BB;',
        '  --focus-ring: #3366CC;',
        '}'
      )
    );
  });

  it('refuses a malformed hex', () => {
    expect(expectErr(accentCss('#33'))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      value: '#33',
    });
  });
});

describe('brandKey', () => {
  it('is the hex lower-cased, without the hash', () => {
    expect(brandKey('#3366CC')).toBe('3366cc');
  });
});

describe('brandAccentCss', () => {
  it('writes the accent roles under the element carrying the brand key, in each mode family', () => {
    const css = expectOk(brandAccentCss('#3366CC'));

    expect(css).toContain(
      ':root[data-theme]:is([data-mode="dark"], [data-mode="oled"]) [data-brand="3366cc"] {'
    );
    expect(css).toContain(':root[data-theme]:is([data-mode="light"]) [data-brand="3366cc"] {');
  });

  it('sets the six accent roles and nothing else', () => {
    const properties = [...expectOk(brandAccentCss('#3366cc')).matchAll(/^ {2}(--[a-z-]+):/gm)].map(
      ([, property]) => property
    );

    expect(new Set(properties)).toEqual(
      new Set([
        '--accent',
        '--accent-hover',
        '--accent-soft',
        '--on-accent',
        '--accent-ink',
        '--focus-ring',
      ])
    );
  });

  it.each(['#ffff00', '#fefefe', '#010101'])('derives from the hostile %s', (hex) => {
    expect(expectOk(brandAccentCss(hex))).toContain(`[data-brand="${brandKey(hex)}"]`);
  });

  it('refuses a malformed hex', () => {
    expect(expectErr(brandAccentCss('#33'))).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
  });
});
