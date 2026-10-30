import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en settings', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'settings.title', expected: 'Settings' },
    { key: 'settings.notSaved', expected: 'Not saved to your account' },
    { key: 'settings.signIn', expected: 'Sign in' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'settings.sectionTitle', args: { section: 'advanced' }, expected: 'Fine-tune the look' },
    { key: 'settings.rowLabel', args: { row: 'radius' }, expected: 'Corners' },
    {
      key: 'settings.rowKeywords',
      args: { row: 'radius' },
      expected: 'corners rounded round sharp',
    },
    { key: 'settings.resultCount', args: { count: 1 }, expected: '1 setting' },
    { key: 'settings.resultCount', args: { count: 3 }, expected: '3 settings' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
