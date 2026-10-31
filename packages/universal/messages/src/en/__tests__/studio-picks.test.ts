import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio picks', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.adminTabCuration', expected: 'Curation' },
    { key: 'studio.pickNew', expected: 'Schedule a pick' },
    { key: 'studio.pickCancelConfirm', expected: 'Cancel pick' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('counts the note against its limit', () => {
    expect(t('studio.pickNoteCount', { count: 12, max: 280 })).toEqual({
      ok: true,
      value: '12 of 280',
    });
  });
});
