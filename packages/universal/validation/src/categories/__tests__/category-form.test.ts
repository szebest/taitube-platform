import { isOk } from '@vp/result';
import { validateCategoryForm, validateCategoryName } from '../category-form';

const form = { name: 'Music', slug: 'music', description: 'Tunes' };

describe('@vp/validation: validateCategoryName', () => {
  it('trims and accepts a name within bounds', () => {
    expect(isOk(validateCategoryName('  Music  '))).toBe(true);
  });

  it.each([
    { name: 'an empty name', value: '' },
    { name: 'a name over the ceiling', value: 'a'.repeat(101) },
  ])('rejects $name', ({ value }) => {
    expect(isOk(validateCategoryName(value))).toBe(false);
  });
});

describe('@vp/validation: validateCategoryForm', () => {
  it('accepts a well-formed category and returns the input unchanged', () => {
    const result = validateCategoryForm(form);

    expect(isOk(result) && result.value).toBe(form);
  });

  it.each([
    { name: 'the name', patch: { name: '' }, field: 'name' },
    { name: 'the slug', patch: { slug: 'Not A Slug' }, field: 'slug' },
  ])('rejects a form whose $name is wrong and says which field', ({ patch, field }) => {
    const result = validateCategoryForm({ ...form, ...patch });

    expect(isOk(result)).toBe(false);
    expect(!isOk(result) && result.error.field).toBe(field);
  });
});
