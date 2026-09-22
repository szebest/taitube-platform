import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, STRANGER, aCategory } from '../../__tests__/entities';
import { decideCategoryUpdate } from '../update-category.rule';

const category = aCategory();
const base = { actor: ADMIN, category, categoryId: category.id };

describe('@vp/domain-rules: decideCategoryUpdate', () => {
  it('accepts a patch touching only the name', () => {
    expect(isOk(decideCategoryUpdate({ ...base, patch: { name: 'Sounds' } }))).toBe(true);
  });

  it('accepts an empty patch, because an unsupplied field is not an empty one', () => {
    expect(isOk(decideCategoryUpdate({ ...base, patch: {} }))).toBe(true);
  });

  it('refuses a caller without the role', () => {
    const result = decideCategoryUpdate({ ...base, actor: STRANGER, patch: {} });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('reports an absent category', () => {
    const result = decideCategoryUpdate({ ...base, category: null, patch: {} });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);
  });

  it.each([
    { name: 'an empty name', patch: { name: '' }, field: 'name' },
    { name: 'a malformed slug', patch: { slug: 'Not A Slug' }, field: 'slug' },
  ])('rejects $name and names the field', ({ patch, field }) => {
    const result = decideCategoryUpdate({ ...base, patch });

    expect(isErr(result) && 'field' in result.error && result.error.field).toBe(field);
  });
});
