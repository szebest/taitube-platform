import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio live', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.liveNav', expected: 'Na żywo' },
    { key: 'studio.liveStop', expected: 'Zakończ transmisję' },
    { key: 'studio.liveOverlayNewSubscriber', expected: 'Nowy subskrybent!' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { seconds: 1, expected: 'Tryb powolny: 1 sekunda' },
    { seconds: 5, expected: 'Tryb powolny: 5 sekund' },
    { seconds: 30, expected: 'Tryb powolny: 30 sekund' },
  ])('renders the slow mode for $seconds s', ({ seconds, expected }) => {
    expect(t('studio.liveSlowModeOn', { seconds })).toEqual({ ok: true, value: expected });
  });
});
