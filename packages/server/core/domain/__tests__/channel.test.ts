import {
  HANDLE_CANDIDATE_ATTEMPTS,
  HANDLE_MAX_LENGTH,
  handleCandidates,
  isReservedHandle,
  isValidHandleFormat,
  normalizeHandle,
} from '../channel';

const SUB = '018f2c4a-1111-7000-8000-000000000001';

function take(email: string, sub: string, count: number): string[] {
  const taken: string[] = [];
  for (const candidate of handleCandidates(email, sub)) {
    taken.push(candidate);
    if (taken.length === count) break;
  }
  return taken;
}

describe('core/domain: channel handles', () => {
  describe('isValidHandleFormat', () => {
    it.each([['abc'], ['a_b.c-d'], ['A1'.padEnd(30, 'x')]])('accepts %s', (handle) => {
      expect(isValidHandleFormat(handle)).toBe(true);
    });

    it.each([['ab'], ['x'.repeat(31)], ['has space'], ['emoji🙂']])('rejects %s', (handle) => {
      expect(isValidHandleFormat(handle)).toBe(false);
    });
  });

  describe('normalizeHandle', () => {
    it.each([
      ['@Creator', 'creator'],
      ['  Creator ', 'creator'],
      ['creator', 'creator'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeHandle(input)).toBe(expected);
    });
  });

  describe('handleCandidates', () => {
    it.each([
      { scenario: 'offers the email local part first', email: 'ada@example.com', first: 'ada' },
      {
        scenario: 'falls back to the subject when the email has no local part',
        email: '@example.com',
        first: '018f2c4a',
      },
      {
        scenario: 'replaces characters a handle may not contain',
        email: 'ada+lovelace!@example.com',
        first: 'ada_lovelace_',
      },
      {
        scenario: 'pads a local part that is too short to be a handle',
        email: 'ab@example.com',
        first: 'user_ab',
      },
    ])('$scenario', ({ email, first }) => {
      expect(take(email, SUB, 1)).toEqual([first]);
    });

    it('never offers a reserved handle', () => {
      const offered = take('admin@example.com', SUB, 5);

      expect(offered[0]).toBe('u_admin');
      expect(offered.some(isReservedHandle)).toBe(false);
    });

    it('disambiguates with part of the subject, then with numbers', () => {
      expect(take('ada@example.com', SUB, 4)).toEqual([
        'ada',
        'ada_018f',
        'ada_018f1',
        'ada_018f2',
      ]);
    });

    it('uses a placeholder discriminator when the subject has no alphanumerics', () => {
      expect(take('ada@example.com', '---', 2)).toEqual(['ada', 'ada_01']);
    });

    it('keeps every candidate a valid handle, however long the local part', () => {
      const offered = take(`${'x'.repeat(60)}@example.com`, SUB, 25);

      expect(offered.every(isValidHandleFormat)).toBe(true);
      expect(offered.every((handle) => handle.length <= HANDLE_MAX_LENGTH)).toBe(true);
    });

    it('gives up rather than looping forever on a saturated base', () => {
      expect([...handleCandidates('ada@example.com', SUB)]).toHaveLength(
        HANDLE_CANDIDATE_ATTEMPTS + 2
      );
    });
  });
});
