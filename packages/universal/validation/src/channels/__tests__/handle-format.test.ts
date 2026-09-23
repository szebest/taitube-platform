import { isErr, isOk } from '@vp/result';
import {
  HANDLE_CANDIDATE_ATTEMPTS,
  HANDLE_MAX_LENGTH,
  handleCandidates,
  isReservedHandle,
  isValidHandleFormat,
  normalizeHandle,
  validateHandle,
} from '../handle-format';

describe('@vp/validation: handle format', () => {
  it.each([{ handle: 'abc' }, { handle: 'a_b.c-d' }, { handle: 'a'.repeat(30) }])(
    'accepts $handle',
    ({ handle }) => {
      expect(isValidHandleFormat(handle)).toBe(true);
    }
  );

  it.each([
    { handle: 'ab' },
    { handle: 'a'.repeat(31) },
    { handle: 'has space' },
    { handle: 'e!' },
  ])('rejects $handle', ({ handle }) => {
    expect(isValidHandleFormat(handle)).toBe(false);
  });

  it.each([{ handle: 'admin' }, { handle: 'ADMIN' }, { handle: 'videos' }])(
    'treats $handle as reserved',
    ({ handle }) => {
      expect(isReservedHandle(handle)).toBe(true);
    }
  );

  it.each([
    { input: '@Mateusz', expected: 'mateusz' },
    { input: '  Mateusz  ', expected: 'mateusz' },
  ])('normalises $input to $expected', ({ input, expected }) => {
    expect(normalizeHandle(input)).toBe(expected);
  });
});

describe('@vp/validation: validateHandle', () => {
  it('lowercases a valid handle on the way through', () => {
    const result = validateHandle('Mateusz');

    expect(isOk(result) && result.value).toBe('mateusz');
  });

  it.each([
    { name: 'a malformed handle', handle: 'ab' },
    { name: 'a leading @, which the format has never accepted', handle: '@mateusz' },
    { name: 'a handle over the ceiling', handle: 'a'.repeat(31) },
  ])('rejects $name', ({ handle }) => {
    expect(isErr(validateHandle(handle))).toBe(true);
  });

  it('accepts a reserved handle, because availability is not a format question', () => {
    expect(isOk(validateHandle('admin'))).toBe(true);
  });
});

describe('@vp/validation: handleCandidates', () => {
  function take(count: number, email: string, sub: string): string[] {
    const out: string[] = [];
    for (const candidate of handleCandidates(email, sub)) {
      out.push(candidate);
      if (out.length === count) break;
    }
    return out;
  }

  it('offers the identity name first', () => {
    expect(take(1, 'mateusz@example.com', 'abcd1234')[0]).toBe('mateusz');
  });

  it('only ever yields claimable handles', () => {
    for (const candidate of take(20, 'admin@example.com', 'abcd1234')) {
      expect(isValidHandleFormat(candidate)).toBe(true);
      expect(isReservedHandle(candidate)).toBe(false);
      expect(candidate.length).toBeLessThanOrEqual(HANDLE_MAX_LENGTH);
    }
  });

  it('prefixes a reserved base rather than yielding it', () => {
    expect(take(1, 'admin@example.com', 'abcd1234')[0]).toBe('u_admin');
  });

  it('pads a base that is too short', () => {
    expect(take(1, 'ab@example.com', 'abcd1234')[0]).toBe('user_ab');
  });

  it('keeps yielding distinct candidates after the first two', () => {
    expect(new Set(take(10, 'mateusz@example.com', 'abcd1234')).size).toBe(10);
  });

  it('disambiguates with part of the subject, then with numbers', () => {
    expect(take(4, 'ada@example.com', '018f1b2c')).toEqual([
      'ada',
      'ada_018f',
      'ada_018f1',
      'ada_018f2',
    ]);
  });

  it('uses a placeholder discriminator when the subject has no alphanumerics', () => {
    expect(take(2, 'ada@example.com', '---')).toEqual(['ada', 'ada_01']);
  });

  it('keeps every candidate valid however long the local part', () => {
    const offered = take(25, `${'x'.repeat(60)}@example.com`, '018f1b2c');

    expect(offered.every(isValidHandleFormat)).toBe(true);
    expect(offered.every((handle) => handle.length <= HANDLE_MAX_LENGTH)).toBe(true);
  });

  it('gives up rather than looping forever on a saturated base', () => {
    expect([...handleCandidates('ada@example.com', '018f1b2c')]).toHaveLength(
      HANDLE_CANDIDATE_ATTEMPTS + 2
    );
  });
});
