import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en channels', () => {
  const { t } = translatorFor('en');

  it.each([
    { count: 1, expected: '1 subscriber' },
    { count: 12_345, expected: '12K subscribers' },
  ])('counts $count subscribers', ({ count, expected }) => {
    expect(t('channels.subscribers', { count })).toEqual({ ok: true, value: expected });
  });

  it('prefixes a handle', () => {
    expect(t('channels.handle', { handle: 'ada' })).toEqual({ ok: true, value: '@ada' });
  });
});
