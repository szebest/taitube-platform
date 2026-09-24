import { isOk } from '@vp/result';
import { validateVideoMetadata } from '../metadata';

describe('@vp/validation: validateVideoMetadata', () => {
  it.each([
    { name: 'a title and description within bounds', input: { title: 'ok', description: 'fine' } },
    { name: 'an absent title', input: { description: 'fine' } },
    { name: 'a null description', input: { title: 'ok', description: null } },
    { name: 'an empty patch', input: {} },
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
});
