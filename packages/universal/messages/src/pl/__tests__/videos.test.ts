import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl videos', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([{ key: 'videos.moreLikeThis', expected: 'Podobne filmy' }] as const)(
    'renders $key with no arguments',
    ({ key, expected }) => {
      expect(t(key)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
    { key: 'videos.views', args: { count: 1 }, expected: '1 wyświetlenie' },
    { key: 'videos.views', args: { count: 3 }, expected: '3 wyświetlenia' },
    { key: 'videos.views', args: { count: 5 }, expected: '5 wyświetleń' },
    { key: 'videos.rank', args: { position: 3 }, expected: '3.' },
    { key: 'videos.resolution', args: { height: 1080 }, expected: '1080p' },
    { key: 'videos.visibility', args: { visibility: 'unlisted' }, expected: 'Niepubliczny' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
