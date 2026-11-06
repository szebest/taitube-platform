import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl clips', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'clips.clip', expected: 'Klip' },
    { key: 'clips.dialogTitle', expected: 'Utwórz klip z tego filmu' },
    { key: 'clips.saved', expected: 'Klip zapisany, link skopiowany' },
    { key: 'clips.deleteTitle', expected: 'Usunąć ten klip?' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'clips.dialogDescription',
      args: { min: 5, max: 60 },
      expected:
        'Wybierz fragment trwający od 5 do 60 sekund. Każdy, kto ma link, odtworzy tylko tę część.',
    },
    {
      key: 'clips.rangeSummary',
      args: { start: '0:10', end: '0:40', length: '0:30' },
      expected: 'Od 0:10 do 0:40, długość: 0:30',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
