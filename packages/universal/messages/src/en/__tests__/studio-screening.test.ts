import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio screening', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.screeningTitle', expected: 'Held and flagged' },
    { key: 'studio.screeningApprove', expected: 'Approve' },
    { key: 'studio.creatorScreeningHeldTitle', expected: 'This video is on hold' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([{ title: 'Cats' }, { title: 'Dogs' }])(
    'renders the reject title for $title',
    ({ title }) => {
      expect(t('studio.screeningRejectTitle', { title })).toEqual({
        ok: true,
        value: `Reject ${title}?`,
      });
    }
  );

  it.each([
    { reason: 'DUPLICATE', expected: 'Duplicate of another video' },
    { reason: 'BLANK', expected: 'Blank or frozen video' },
  ] as const)('names the reason $reason', ({ reason, expected }) => {
    expect(t('studio.screeningReasonName', { reason })).toEqual({ ok: true, value: expected });
  });
});
