import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio batch', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.batchDeleted', args: { count: 22 }, expected: '22 filmy usunięte' },
    { key: 'studio.batchVisibilitySet', args: { count: 1 }, expected: '1 film zaktualizowany' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
