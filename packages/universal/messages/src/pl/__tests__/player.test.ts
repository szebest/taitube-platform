import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl player', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'player.play', expected: 'Odtwórz' },
    { key: 'player.unmute', expected: 'Włącz dźwięk' },
    { key: 'player.fullscreen', expected: 'Pełny ekran' },
    { key: 'player.pictureInPicture', expected: 'Obraz w obrazie' },
    { key: 'player.unavailable', expected: 'Ten film jest niedostępny' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'player.autoQualityAt', args: { height: 1080 }, expected: 'Auto (1080p)' },
    { key: 'player.rate', args: { rate: 1.5 }, expected: '1,5x' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
