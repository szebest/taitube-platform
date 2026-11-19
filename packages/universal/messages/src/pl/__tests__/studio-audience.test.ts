import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio audience', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { device: 'desktop', expected: 'Komputer' },
    { device: 'mobile', expected: 'Telefon' },
    { device: 'tablet', expected: 'Tablet' },
    { device: 'unknown', expected: 'Nieokreślone' },
  ] as const)('names the $device device', ({ device, expected }) => {
    expect(t('studio.deviceName', { device })).toEqual({ ok: true, value: expected });
  });

  it('counts the days of the first week from one', () => {
    expect(t('studio.benchmarkDay', { day: 3 })).toEqual({ ok: true, value: 'Dzień 3' });
  });

  it('names the time and the share of a drop-off', () => {
    expect(t('studio.dropOffBadge', { time: '0:42', share: '18%' })).toEqual({
      ok: true,
      value: '0:42, 18% odchodzi tutaj',
    });
  });
});
