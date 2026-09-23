import { ErrorCodes, categorySlugConflict, databaseUnavailable } from '@vp/errors';
import { presentAdminCategoryFailure } from '../categories.presenter';

const instance = '/v1/admin/categories';

describe('presentAdminCategoryFailure', () => {
  it('turns a slug conflict into a field error the admin form can highlight', () => {
    const problem = presentAdminCategoryFailure(categorySlugConflict('music'), instance);

    expect(problem.status).toBe(409);
    expect(problem.errors).toEqual([{ field: 'slug', slug: 'music' }]);
  });

  it('tells the operator what to do about a category still in use', () => {
    const problem = presentAdminCategoryFailure(
      { code: ErrorCodes.CATEGORY_IN_USE, message: 'in use', categoryId: 'c1', videoCount: 3 },
      instance
    );

    expect(problem.status).toBe(409);
    expect(problem.detail).toContain('3 video(s)');
  });

  it.each([
    {
      name: 'an absent category',
      failure: { code: ErrorCodes.CATEGORY_NOT_FOUND, message: 'gone', idOrSlug: 'c1' } as const,
      status: 404,
    },
    {
      name: 'an anonymous caller',
      failure: {
        code: ErrorCodes.UNAUTHORIZED,
        message: 'sign in',
        action: 'create',
        subject: 'Category',
      } as const,
      status: 401,
    },
    {
      name: 'a caller without the role',
      failure: {
        code: ErrorCodes.FORBIDDEN,
        message: 'no',
        action: 'create',
        subject: 'Category',
        userId: 'u1',
      } as const,
      status: 403,
    },
  ])('gives $name the standard $status', ({ failure, status }) => {
    expect(presentAdminCategoryFailure(failure, instance).status).toBe(status);
  });

  it('keeps the repository operation off the wire on a dead database', () => {
    const problem = presentAdminCategoryFailure(databaseUnavailable('create'), instance);

    expect(problem.status).toBe(503);
    expect(JSON.stringify(problem)).not.toContain('create');
  });
});
