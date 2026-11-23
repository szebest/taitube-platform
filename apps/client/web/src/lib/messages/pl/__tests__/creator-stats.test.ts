import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('apps/client/web: pl creator stats', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'creatorStats.private', expected: 'Widzisz to tylko ty i twój zespół' },
    { key: 'creatorStats.first48Hours', expected: 'Pierwsze 48 godzin' },
    { key: 'creatorStats.openAnalytics', expected: 'Otwórz pełną analitykę' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'creatorStats.dropOff',
      args: { time: '0:42', share: '18%' },
      expected: '0:42, odchodzi 18%',
    },
    { key: 'creatorStats.dropOffSeek', args: { time: '0:42' }, expected: 'Odtwarzaj od 0:42' },
  ] as const)('renders $key with its arguments', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
