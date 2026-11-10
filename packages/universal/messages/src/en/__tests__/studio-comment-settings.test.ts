import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio comment settings', () => {
  const { t } = translatorFor('en');

  it.each([
    { mode: 'none', expected: 'Nothing' },
    { mode: 'all', expected: 'Everything' },
  ] as const)('names the review mode $mode', ({ mode, expected }) => {
    expect(t('studio.settingsReviewOption', { mode })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { seconds: 'off', expected: 'Off' },
    { seconds: '60', expected: '1 minute' },
  ] as const)('names the slow mode $seconds', ({ seconds, expected }) => {
    expect(t('studio.settingsSlowOption', { seconds })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { seen: 'hold_silent', expected: 'The author sees the comment as published.' },
    { seen: 'remove_visible', expected: 'The author gets the reason and a notification.' },
  ] as const)('says what the author sees: $seen', ({ seen, expected }) => {
    expect(t('studio.settingsDefaultSeen', { seen })).toEqual({ ok: true, value: expected });
  });

  it('says when a ban ends', () => {
    expect(t('studio.settingsRestrictionUntil', { date: 'Dec 1' })).toEqual({
      ok: true,
      value: 'Until Dec 1',
    });
  });
});
