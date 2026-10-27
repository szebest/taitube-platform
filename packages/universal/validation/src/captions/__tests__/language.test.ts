import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateCaptionLanguage } from '../language';

describe('@vp/validation: validateCaptionLanguage', () => {
  it.each([
    { language: 'en', tag: 'en' },
    { language: 'EN-us', tag: 'en-US' },
    { language: 'pt-br', tag: 'pt-BR' },
    { language: 'zh-hant', tag: 'zh-Hant' },
  ])('reads $language as $tag', ({ language, tag }) => {
    expect(expectOk(validateCaptionLanguage('lang', language))).toBe(tag);
  });

  it.each(['', 'english!', '../en', 'en_US', 'e'])('rejects %j, naming the field', (language) => {
    expect(expectErr(validateCaptionLanguage('lang', language))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'lang',
      language,
    });
  });
});
