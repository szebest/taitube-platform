import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio screening', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.screeningTitle', expected: 'Wstrzymane i oflagowane' },
    { key: 'studio.screeningApprove', expected: 'Zatwierdź' },
    { key: 'studio.creatorScreeningHeldTitle', expected: 'Ten film jest wstrzymany' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([{ title: 'Koty' }, { title: 'Psy' }])(
    'renders the reject title for $title',
    ({ title }) => {
      expect(t('studio.screeningRejectTitle', { title })).toEqual({
        ok: true,
        value: `Odrzucić film ${title}?`,
      });
    }
  );

  it.each([
    { reason: 'DUPLICATE', expected: 'Duplikat innego filmu' },
    { reason: 'BLANK', expected: 'Pusty lub zatrzymany film' },
  ] as const)('names the reason $reason', ({ reason, expected }) => {
    expect(t('studio.screeningReasonName', { reason })).toEqual({ ok: true, value: expected });
  });
});
