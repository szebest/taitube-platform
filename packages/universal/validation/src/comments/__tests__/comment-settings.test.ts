import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { validateCommentSettings } from '../comment-settings';

const valid = {
  blockedWords: ['spam'],
  linkAllowlist: ['example.com'],
  slowModeSeconds: 30,
  minAccountAgeDays: 7,
};

describe('@vp/validation: validateCommentSettings', () => {
  it.each([
    { scenario: 'a full set', input: valid, expected: valid },
    {
      scenario: 'the bounds',
      input: {
        blockedWords: ['ab', 'x'.repeat(40)],
        linkAllowlist: [],
        slowModeSeconds: null,
        minAccountAgeDays: 30,
      },
      expected: {
        blockedWords: ['ab', 'x'.repeat(40)],
        linkAllowlist: [],
        slowModeSeconds: null,
        minAccountAgeDays: 30,
      },
    },
    {
      scenario: 'words and hosts that repeat, differ in case or carry spaces',
      input: {
        ...valid,
        blockedWords: [' Spam ', 'SPAM', 'free  money', 'Free Money', 'café', 'CAFE'],
        linkAllowlist: ['Example.com ', 'example.com', 'b.example.org'],
      },
      expected: {
        ...valid,
        blockedWords: ['Spam', 'free money', 'café'],
        linkAllowlist: ['example.com', 'b.example.org'],
      },
    },
    ...[5, 10, 30, 60, 300, null].map((slowModeSeconds) => ({
      scenario: `slow mode ${slowModeSeconds}`,
      input: { ...valid, slowModeSeconds },
      expected: { ...valid, slowModeSeconds },
    })),
    ...[0, 30].map((minAccountAgeDays) => ({
      scenario: `an account age of ${minAccountAgeDays} days`,
      input: { ...valid, minAccountAgeDays },
      expected: { ...valid, minAccountAgeDays },
    })),
  ])('accepts $scenario', ({ input, expected }) => {
    const result = validateCommentSettings(input);

    expect(isOk(result) && result.value).toEqual(expected);
  });

  it.each([
    { field: 'blockedWords', patch: { blockedWords: ['a'] } },
    { field: 'blockedWords', patch: { blockedWords: ['x'.repeat(41)] } },
    { field: 'blockedWords', patch: { blockedWords: [' '] } },
    {
      field: 'blockedWords',
      patch: { blockedWords: Array.from({ length: 201 }, (_, i) => `word${i}`) },
    },
    {
      field: 'linkAllowlist',
      patch: { linkAllowlist: Array.from({ length: 51 }, (_, i) => `h${i}.com`) },
    },
    { field: 'linkAllowlist', patch: { linkAllowlist: ['https://example.com'] } },
    { field: 'linkAllowlist', patch: { linkAllowlist: ['example.com/path'] } },
    { field: 'linkAllowlist', patch: { linkAllowlist: ['not a host'] } },
    { field: 'linkAllowlist', patch: { linkAllowlist: ['localhost'] } },
    { field: 'slowModeSeconds', patch: { slowModeSeconds: 7 } },
    { field: 'slowModeSeconds', patch: { slowModeSeconds: 0 } },
    { field: 'minAccountAgeDays', patch: { minAccountAgeDays: -1 } },
    { field: 'minAccountAgeDays', patch: { minAccountAgeDays: 31 } },
    { field: 'minAccountAgeDays', patch: { minAccountAgeDays: 1.5 } },
  ])('rejects $field for $patch', ({ field, patch }) => {
    const result = validateCommentSettings({ ...valid, ...patch });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
    });
  });
});
