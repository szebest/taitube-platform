import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio audience', () => {
  const { t } = translatorFor('en');

  it.each([
    { device: 'desktop', expected: 'Desktop' },
    { device: 'mobile', expected: 'Mobile' },
    { device: 'tablet', expected: 'Tablet' },
    { device: 'unknown', expected: 'Not reported' },
  ] as const)('names the $device device', ({ device, expected }) => {
    expect(t('studio.deviceName', { device })).toEqual({ ok: true, value: expected });
  });

  it('counts the days of the first week from one', () => {
    expect(t('studio.benchmarkDay', { day: 3 })).toEqual({ ok: true, value: 'Day 3' });
  });

  it('names the time and the share of a drop-off', () => {
    expect(t('studio.dropOffBadge', { time: '0:42', share: '18%' })).toEqual({
      ok: true,
      value: '0:42, 18% leave here',
    });
  });
});
