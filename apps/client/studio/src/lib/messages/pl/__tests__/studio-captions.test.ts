import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio captions', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.captionsTitle', expected: 'Napisy' },
    { key: 'studio.captionsDefaultLabel', expected: 'Generuj napisy dla nowych filmów' },
    { key: 'studio.captionsEditorSave', expected: 'Zapisz napisy' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { status: 'pending', expected: 'Oczekuje' },
    { status: 'ready', expected: 'Gotowe' },
  ] as const)('names a $status track', ({ status, expected }) => {
    expect(t('studio.captionsStatus', { status })).toEqual({ ok: true, value: expected });
  });
});
