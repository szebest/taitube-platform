import { isErr, isOk } from '@vp/result';
import { handleCandidates, isReservedHandle, validateHandle } from '../handle-format';

describe('@vp/validation: isReservedHandle', () => {
  it.each([
    { handle: 'admin', reserved: true },
    { handle: 'ADMIN', reserved: true },
    { handle: 'videos', reserved: true },
    { handle: 'api', reserved: true },
    { handle: 'studio', reserved: true },
    { handle: 'feed', reserved: true },
    { handle: 'regularuser', reserved: false },
  ])('reports $handle as reserved=$reserved', ({ handle, reserved }) => {
    expect(isReservedHandle(handle)).toBe(reserved);
  });
});

describe('@vp/validation: validateHandle', () => {
  it.each([
    { handle: 'abc', normalized: 'abc' },
    { handle: 'a_b.c-d', normalized: 'a_b.c-d' },
    { handle: 'john_doe-123.tv', normalized: 'john_doe-123.tv' },
    { handle: 'a'.repeat(30), normalized: 'a'.repeat(30) },
    { handle: 'Mateusz', normalized: 'mateusz' },
  ])('accepts $handle as $normalized', ({ handle, normalized }) => {
    const result = validateHandle(handle);

    expect(isOk(result) && result.value).toBe(normalized);
  });

  it.each([
    { name: 'a handle under the floor', handle: 'ab' },
    { name: 'a handle over the ceiling', handle: 'a'.repeat(31) },
    { name: 'an inner space', handle: 'has space' },
    { name: 'surrounding whitespace', handle: '  Mateusz  ' },
    { name: 'a punctuation mark outside the set', handle: 'e!' },
    { name: 'an inner @', handle: 'john@doe' },
    { name: 'a leading @, which the format has never accepted', handle: '@mateusz' },
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
      expect(isOk(validateHandle(candidate))).toBe(true);
      expect(isReservedHandle(candidate)).toBe(false);
      expect(candidate.length).toBeLessThanOrEqual(30);
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

    expect(offered.every((handle) => isOk(validateHandle(handle)))).toBe(true);
    expect(offered.every((handle) => handle.length <= 30)).toBe(true);
  });

  it('gives up rather than looping forever on a saturated base', () => {
    expect([...handleCandidates('ada@example.com', '018f1b2c')]).toHaveLength(1002);
  });
});
