import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl studio picks', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.adminTabCuration', expected: 'Kuracja' },
    { key: 'studio.pickTitle', expected: 'Wybór dnia' },
    { key: 'studio.pickCancelKeep', expected: 'Zachowaj wybór' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.pickVideoChosen', args: { title: 'Wiosna' }, expected: 'Wybrano: Wiosna' },
    { key: 'studio.pickNoteCount', args: { count: 12, max: 120 }, expected: '12 z 120' },
    {
      key: 'studio.pickWindowRange',
      args: { start: 'pon.', end: 'wt.' },
      expected: 'od pon. do wt.',
    },
    {
      key: 'studio.pickWindowOverlap',
      args: { title: 'Wiosna', window: 'od pon. do wt.' },
      expected: 'Ten termin nakłada się na inny wybór: Wiosna, od pon. do wt..',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
