import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en ui', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'ui.close', expected: 'Close' },
    { key: 'ui.loading', expected: 'Loading' },
    { key: 'ui.required', expected: 'required' },
    { key: 'ui.noResults', expected: 'No results' },
    { key: 'ui.cancelled', expected: 'Cancelled' },
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

  it.each([
    { key: 'ui.reorder', expected: 'Reorder Lisbon at night' },
    { key: 'ui.pickedUp', expected: 'Picked up Lisbon at night, position 3 of 12' },
    { key: 'ui.movedTo', expected: 'Moved to position 3' },
    { key: 'ui.droppedAt', expected: 'Dropped at position 3' },
  ] as const)('renders $key with the item and its place', ({ key, expected }) => {
    expect(t(key, { name: 'Lisbon at night', position: '3', count: '12' })).toEqual({
      ok: true,
      value: expected,
    });
  });
});
