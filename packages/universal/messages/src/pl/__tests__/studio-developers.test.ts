import { translatorFor } from '../../__tests__/studio-fixtures';
import { pl } from '../studio-catalogue';

describe('@vp/messages: pl studio developers', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.developersNav', args: undefined, expected: 'Dla programistów' },
    { key: 'studio.exportRows', args: { count: 3 }, expected: '3 wiersze' },
    { key: 'studio.exportRows', args: { count: 5 }, expected: '5 wierszy' },
    { key: 'studio.copiedField', args: { label: 'Token' }, expected: 'Skopiowano: Token' },
    { key: 'studio.teamAuditViaToken', args: undefined, expected: 'tokenem' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
