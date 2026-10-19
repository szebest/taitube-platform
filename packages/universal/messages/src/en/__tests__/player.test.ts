import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en player', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'player.controls', expected: 'Player controls' },
    { key: 'player.play', expected: 'Play' },
    { key: 'player.pause', expected: 'Pause' },
    { key: 'player.mute', expected: 'Mute' },
    { key: 'player.unmute', expected: 'Unmute' },
    { key: 'player.volume', expected: 'Volume' },
    { key: 'player.seek', expected: 'Seek' },
    { key: 'player.settings', expected: 'Settings' },
    { key: 'player.quality', expected: 'Quality' },
    { key: 'player.autoQuality', expected: 'Auto' },
    { key: 'player.speed', expected: 'Playback speed' },
    { key: 'player.normalSpeed', expected: 'Normal' },
    { key: 'player.fullscreen', expected: 'Full screen' },
    { key: 'player.exitFullscreen', expected: 'Exit full screen' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'autoQualityAt',
      rendered: t('player.autoQualityAt', { height: 2160 }),
      expected: 'Auto (2160p)',
    },
    { key: 'rate', rendered: t('player.rate', { rate: 0.25 }), expected: '0.25x' },
  ])('renders $key', ({ rendered, expected }) => {
    expect(rendered).toEqual({ ok: true, value: expected });
  });
});
