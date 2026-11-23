import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en settings rows', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'settings.rowLabel', args: { row: 'radius' }, expected: 'Corners' },
    {
      key: 'settings.rowKeywords',
      args: { row: 'radius' },
      expected: 'corners rounded round sharp',
    },
    { key: 'settings.rowLabel', args: { row: 'captions-size' }, expected: 'Captions size' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
