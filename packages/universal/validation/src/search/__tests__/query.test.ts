import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { isPlainSearchQuery, validateSearchQuery } from '../query';

describe('@vp/validation: validateSearchQuery', () => {
  it.each([
    { raw: '  Learn   React ', normalized: 'learn react' },
    { raw: 'FIRESHIP', normalized: 'fireship' },
    { raw: '\tcoding\nmusic', normalized: 'coding music' },
    { raw: 'x'.repeat(100), normalized: 'x'.repeat(100) },
  ])('normalizes $raw to $normalized', ({ raw, normalized }) => {
    const result = validateSearchQuery(raw);

    expect(isOk(result) && result.value).toBe(normalized);
  });

  it.each([
    { name: 'blank', raw: '   ' },
    { name: 'one character too long', raw: 'x'.repeat(101) },
  ])('rejects a $name query on the q field', ({ raw }) => {
    const result = validateSearchQuery(raw);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'q',
      minLength: 1,
      maxLength: 100,
    });
  });

  it.each(['-lofi', '-lofi -jazz', 'or', '!!!'])(
    'rejects %j, which holds no word to search for',
    (raw) => {
      const result = validateSearchQuery(raw);

      expect(isErr(result) && result.error).toMatchObject({
        code: ErrorCodes.VALIDATION_FAILED,
        field: 'q',
      });
    }
  );

  it.each([
    { text: 'learn react', plain: true },
    { text: 'react -class', plain: false },
    { text: 'react or vue', plain: false },
    { text: '"react hooks"', plain: false },
    { text: 'react!', plain: false },
    { text: 'react?.', plain: false },
    { text: 'żółć 2026', plain: true },
  ])('treats $text as a plain query: $plain', ({ text, plain }) => {
    expect(isPlainSearchQuery(text)).toBe(plain);
  });
});
