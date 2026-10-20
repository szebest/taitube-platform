import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en ui', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'ui.close', expected: 'Close' },
    { key: 'ui.loading', expected: 'Loading' },
    { key: 'ui.appearance', expected: 'Appearance' },
    { key: 'ui.theme', expected: 'Theme' },
    { key: 'ui.mode', expected: 'Mode' },
    { key: 'ui.modeSystem', expected: 'System' },
    { key: 'ui.modeDark', expected: 'Dark' },
    { key: 'ui.modeLight', expected: 'Light' },
    { key: 'ui.modeOled', expected: 'OLED' },
    { key: 'ui.density', expected: 'Density' },
    { key: 'ui.densityComfortable', expected: 'Comfortable' },
    { key: 'ui.densityCompact', expected: 'Compact' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
