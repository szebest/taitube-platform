import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio moderation', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { action: 'approve', expected: 'Zatwierdź' },
    { action: 'shadow_ban', expected: 'Cichy ban' },
  ] as const)('names the action $action', ({ action, expected }) => {
    expect(t('studio.moderationAction', { action })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { count: 1, expected: '1 komentarz zmieniony' },
    { count: 3, expected: '3 komentarze zmienione' },
  ])('counts $count updated comments', ({ count, expected }) => {
    expect(t('studio.moderationBulkDone', { count })).toEqual({ ok: true, value: expected });
  });

  it('reports a partly refused batch', () => {
    expect(t('studio.moderationBulkPartial', { done: 2, total: 3, failed: 1 })).toEqual({
      ok: true,
      value: 'Gotowe: 2 z 3, odrzucone: 1',
    });
  });

  it('names the reason off topic', () => {
    expect(t('studio.moderationReasonOption', { reason: 'off_topic' })).toEqual({
      ok: true,
      value: 'Nie na temat',
    });
  });
});
