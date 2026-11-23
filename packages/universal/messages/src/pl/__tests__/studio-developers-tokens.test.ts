import { translatorFor } from '../../__tests__/studio-fixtures';
import { pl } from '../studio-catalogue';

describe('@vp/messages: pl studio developer tokens', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.tokensRequestsToday', args: { count: 1 }, expected: '1 żądanie dziś' },
    { key: 'studio.tokensRequestsToday', args: { count: 4 }, expected: '4 żądania dziś' },
    { key: 'studio.tokensRequestsToday', args: { count: 12 }, expected: '12 żądań dziś' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it('words an expiry', () => {
    expect(t('studio.tokenExpiryOption', { expiry: '30d' })).toEqual({
      ok: true,
      value: '30 dniach',
    });
  });
});
