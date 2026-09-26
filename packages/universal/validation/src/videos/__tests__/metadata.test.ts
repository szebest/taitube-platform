import { isOk } from '@vp/result';
import { validateVideoMetadata } from '../metadata';

describe('@vp/validation: validateVideoMetadata', () => {
  it.each([
    { name: 'a title and description within bounds', input: { title: 'ok', description: 'fine' } },
    { name: 'an absent title', input: { description: 'fine' } },
    { name: 'a null description', input: { title: 'ok', description: null } },
    { name: 'an empty patch', input: {} },
    { name: 'an empty tag list', input: { tags: [] } },
  ])('accepts $name', ({ input }) => {
    expect(isOk(validateVideoMetadata(input))).toBe(true);
  });

  it.each([
    { name: 'an empty title', input: { title: '' }, field: 'title' },
    {
      name: 'a title over the ceiling',
      input: { title: 'a'.repeat(201) },
      field: 'title',
    },
    {
      name: 'a description over the ceiling',
      input: { description: 'a'.repeat(5001) },
      field: 'description',
    },
  ])('rejects $name and names the field', ({ input, field }) => {
    const result = validateVideoMetadata(input);

    expect(isOk(result)).toBe(false);
    expect(!isOk(result) && result.error.field).toBe(field);
  });

  it('hands back the tags as the tag rule normalized them and the rest untouched', () => {
    const result = validateVideoMetadata({ title: 'ok', tags: [' lofi', 'LOFI', 'jazz '] });

    expect(isOk(result) && result.value).toEqual({ title: 'ok', tags: ['lofi', 'jazz'] });
  });

  it('rejects tags past the ceiling and names the field', () => {
    const result = validateVideoMetadata({ tags: Array.from({ length: 31 }, (_, i) => `t${i}`) });

    expect(!isOk(result) && result.error.field).toBe('tags');
  });
});
