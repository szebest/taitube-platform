import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio captions', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.captionsTitle', expected: 'Captions' },
    { key: 'studio.captionsDefaultLabel', expected: 'Generate captions for new uploads' },
    { key: 'studio.captionsAutoFollowOn', expected: 'Follow the channel default (currently on)' },
    { key: 'studio.captionsEditorSave', expected: 'Save cues' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { kind: 'auto', expected: 'Auto-generated' },
    { kind: 'edited', expected: 'Edited' },
    { kind: 'uploaded', expected: 'Uploaded' },
  ] as const)('names a $kind track', ({ kind, expected }) => {
    expect(t('studio.captionsKind', { kind })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { status: 'pending', expected: 'Pending' },
    { status: 'ready', expected: 'Ready' },
    { status: 'failed', expected: 'Failed' },
    { status: 'disabled', expected: 'Off' },
  ] as const)('names a $status track', ({ status, expected }) => {
    expect(t('studio.captionsStatus', { status })).toEqual({ ok: true, value: expected });
  });

  it('names the language in the editor title', () => {
    expect(t('studio.captionsEditorTitle', { language: 'English' })).toEqual({
      ok: true,
      value: 'Edit cues (English)',
    });
  });
});
