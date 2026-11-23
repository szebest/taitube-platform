import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio live', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.liveNav', expected: 'Live' },
    { key: 'studio.liveStop', expected: 'Stop broadcast' },
    { key: 'studio.liveOverlayNewSubscriber', expected: 'New subscriber!' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { seconds: 1, expected: 'Slow mode: 1 second' },
    { seconds: 30, expected: 'Slow mode: 30 seconds' },
  ])('renders the slow mode for $seconds s', ({ seconds, expected }) => {
    expect(t('studio.liveSlowModeOn', { seconds })).toEqual({ ok: true, value: expected });
  });
});
