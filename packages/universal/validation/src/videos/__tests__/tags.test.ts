import { isErr, isOk } from '@vp/result';
import { validateVideoTags } from '../tags';

const tags = (count: number) => Array.from({ length: count }, (_, i) => `tag-${i}`);

describe('@vp/validation: validateVideoTags', () => {
  it.each([
    { name: 'no tags', input: [], expected: [] },
    { name: 'the ceiling of tags', input: tags(30), expected: tags(30) },
    { name: 'a tag of the longest length', input: ['a'.repeat(30)], expected: ['a'.repeat(30)] },
    { name: 'padded tags, trimmed', input: ['  lofi ', 'jazz'], expected: ['lofi', 'jazz'] },
    {
      name: 'the same tag twice in another case, kept once as first written',
      input: ['LoFi', 'lofi', 'jazz'],
      expected: ['LoFi', 'jazz'],
    },
    {
      name: 'more than the ceiling that collapse under it once duplicates go',
      input: [...tags(30), 'tag-0'],
      expected: tags(30),
    },
  ])('accepts $name', ({ input, expected }) => {
    const result = validateVideoTags(input);

    expect(isOk(result) && result.value).toEqual(expected);
  });

  it.each([
    { name: 'one tag past the ceiling', input: tags(31) },
    { name: 'a tag one character too long', input: ['a'.repeat(31)] },
    { name: 'a blank tag', input: ['lofi', '   '] },
  ])('rejects $name, naming the field and both limits', ({ input }) => {
    const result = validateVideoTags(input);

    expect(isErr(result) && result.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'tags',
      maxTags: 30,
      maxLength: 30,
    });
  });
});
