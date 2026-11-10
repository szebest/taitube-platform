import { isErr, isOk } from '@vp/result';
import { validateBan } from '../ban';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');

describe('@vp/validation: validateBan', () => {
  it.each([
    {
      scenario: 'a permanent ban without a reason',
      input: {},
      expected: { reason: null, expiresAt: null },
    },
    {
      scenario: 'a blank reason',
      input: { reason: '  \n ' },
      expected: { reason: null, expiresAt: null },
    },
    {
      scenario: 'a reason and an end',
      input: { reason: ' spam ', expiresAt: LATER },
      expected: { reason: 'spam', expiresAt: LATER },
    },
  ])('accepts $scenario', ({ input, expected }) => {
    const result = validateBan(input, NOW);

    expect(isOk(result) && result.value).toEqual(expected);
  });

  it.each([
    {
      scenario: 'a reason over 200 characters',
      input: { reason: 'x'.repeat(201) },
      field: 'reason',
    },
    { scenario: 'an end that has passed', input: { expiresAt: NOW }, field: 'expiresAt' },
  ])('refuses $scenario', ({ input, field }) => {
    const result = validateBan(input, NOW);

    expect(isErr(result) && result.error).toMatchObject({ field });
  });
});
