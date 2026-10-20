import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { accentCss } from '../accent-css';
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
