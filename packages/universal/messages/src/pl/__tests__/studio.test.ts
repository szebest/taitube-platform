import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.title', expected: 'Studio twórcy' },
    { key: 'studio.backToWeb', expected: 'Wróć do Taitube' },
    { key: 'studio.analyticsEmptyTitle', expected: 'W tym okresie nie ma jeszcze wyświetleń' },
    { key: 'studio.uploadTitle', expected: 'Prześlij film' },
    { key: 'studio.batchFailed', expected: 'Nic nie zostało zmienione. Spróbuj ponownie.' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.videoStatus', args: { status: 'READY' }, expected: 'Gotowe' },
    {
      key: 'studio.processing',
      args: { status: 'PROCESSING', overall: 42 },
      expected: 'Przetwarzanie, zakodowano 42%',
    },
    {
      key: 'studio.kpiLabel',
      args: { metric: 'views', range: '7d' },
      expected: 'Wyświetlenia, ostatnie 7 dni',
    },
    { key: 'studio.deleteConfirmTitle', args: { count: 1 }, expected: 'Usunąć ten film?' },
    { key: 'studio.deleteConfirmTitle', args: { count: 3 }, expected: 'Usunąć 3 filmy?' },
    { key: 'studio.deleteConfirmTitle', args: { count: 5 }, expected: 'Usunąć 5 filmów?' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
