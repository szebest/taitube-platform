import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio moderation', () => {
  const { t } = translatorFor('en');

  it.each([
    { action: 'approve', expected: 'Approve' },
    { action: 'shadow_ban', expected: 'Shadow ban' },
  ] as const)('names the action $action', ({ action, expected }) => {
    expect(t('studio.moderationAction', { action })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { count: 1, expected: '1 comment updated' },
    { count: 3, expected: '3 comments updated' },
  ])('counts $count updated comments', ({ count, expected }) => {
    expect(t('studio.moderationBulkDone', { count })).toEqual({ ok: true, value: expected });
  });

  it('reports a partly refused batch', () => {
    expect(t('studio.moderationBulkPartial', { done: 2, total: 3, failed: 1 })).toEqual({
      ok: true,
      value: '2 of 3 done, 1 refused',
    });
  });

  it.each([
    { reason: 'off_topic', expected: 'Off topic' },
    { reason: 'other', expected: 'Something else' },
  ] as const)('names the reason $reason', ({ reason, expected }) => {
    expect(t('studio.moderationReasonOption', { reason })).toEqual({ ok: true, value: expected });
  });

  it('names a ban without an end', () => {
    expect(t('studio.moderationDurationOption', { duration: 'forever' })).toEqual({
      ok: true,
      value: 'Until lifted',
    });
  });
});
