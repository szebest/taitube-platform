import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en shorts', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'shorts.title', expected: 'Shorts' },
    { key: 'shorts.emptyTitle', expected: 'Shorts will appear here' },
    {
      key: 'shorts.emptyDescription',
      expected:
        'Short vertical videos are on their way. Until then, the home feed has plenty to watch.',
    },
    { key: 'shorts.browse', expected: 'Browse videos' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the Short that came into view with its channel', () => {
    expect(t('shorts.announce', { title: 'Tram at dusk', channel: 'Marta' })).toEqual({
      ok: true,
      value: 'Tram at dusk, by Marta',
    });
  });
});
