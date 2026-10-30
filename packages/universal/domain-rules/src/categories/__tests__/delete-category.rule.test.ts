import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, STRANGER, aCategory } from '../../__tests__/entities';
import { decideCategoryDelete } from '../delete-category.rule';

const category = aCategory();

describe('@vp/domain-rules: decideCategoryDelete', () => {
  it('accepts an admin deleting an unused category', () => {
    const result = decideCategoryDelete({
      actor: ADMIN,
      category,
      categoryId: category.id,
      videoCount: 0,
    });

    expect(isOk(result) && result.value).toBe(category);
  });

  it('refuses a caller without the role', () => {
    const result = decideCategoryDelete({
      actor: STRANGER,
      category,
      categoryId: category.id,
      videoCount: 0,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('reports an absent category', () => {
    const result = decideCategoryDelete({
      actor: ADMIN,
      category: null,
      categoryId: 'gone',
      videoCount: 0,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);
  });

  it('refuses to delete a category videos still hold', () => {
    const result = decideCategoryDelete({
      actor: ADMIN,
      category,
      categoryId: category.id,
      videoCount: 3,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CATEGORY_IN_USE);
  });
});
