import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { validateCommentContent } from '../content';

describe('@vp/validation: validateCommentContent', () => {
  it.each([
    { name: 'plain text', content: 'great clip', normalized: 'great clip' },
    { name: 'surrounding whitespace', content: '  great clip \n', normalized: 'great clip' },
    { name: 'inner line breaks', content: 'first\nsecond', normalized: 'first\nsecond' },
    { name: 'control characters', content: 'be\u0000ll\u0007', normalized: 'bell' },
    {
      name: 'markup, which is text and never rendered as html',
      content: '<b>bold</b> <script>x</script>',
      normalized: '<b>bold</b> <script>x</script>',
    },
    { name: 'the ceiling in emoji', content: '🙂'.repeat(2000), normalized: '🙂'.repeat(2000) },
  ])('accepts $name', ({ content, normalized }) => {
    const result = validateCommentContent(content);

    expect(isOk(result) && result.value).toBe(normalized);
  });

  it.each([
    { name: 'an empty comment', content: '' },
    { name: 'whitespace only', content: ' \n\t ' },
    { name: 'control characters only', content: '\u0000\u0001' },
    { name: 'one character over the ceiling', content: 'a'.repeat(2001) },
  ])('rejects $name', ({ content }) => {
    const result = validateCommentContent(content);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'content',
      minLength: 1,
      maxLength: 2000,
    });
  });
});
